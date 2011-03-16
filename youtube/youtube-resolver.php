#!/usr/bin/php
<?php

/**
 * @author David Singleton (http://dsingleton.co.uk)
 * @author Christian Muehlhaeuser (http://tomahawk-player.org)
 * A base player resolver written in PHP.
 * Handles basic request/response, encoding.
 */

abstract class PlaydarResolver
{
    protected $name; 
    protected $targetTime; // Lower is better
    protected $timeout; // After which period of time (in seconds) we do not expect results to arrive anymore
    protected $weight; // 1-100. higher means preferable.
    
    
    public function __construct()
    {
//        set_error_handler(array($this, 'errorHandler'), E_ALL);
    }
    
    /**
     * 
     */
    public function handleRequest($fh)
    {
        while (!feof($fh)) {

            // Makes the handler compatable with command line testing and playdar resolver pipeline usage
            if (!$content = fread($fh, 4)) {
                break;
            }
            
            // get the length of the payload from the first 4 bytes:
            $len = current(unpack('N', $content));
            
            // bail on empty request.
            if($len == 0) {
                continue;
            }
            
            // read $len bytes for the actual payload and assume it's a JSON object.
            $request = json_decode(fread($fh, $len));
            
            // Malformed request
            if (!isset($request->artist, $request->track)) {
                continue;
            }
            
            // Let's resolve this bitch
            $results = $this->resolve($request);
            
            // Build response and send
            $response = (Object) array(
                '_msgtype' => 'results',
                'qid' => $request->qid,
                'results' => $results,
            );
            $this->sendResponse($response);
        }
    }
    
    /**
     * Find shit. Returns an array of result object
     */
    abstract function resolve($request);
    
    /**
     * Output reply
     * Puts a 4-byte big-endian int first, denoting length of message
     */
    public function sendResponse($response)
    {
        // i think json_spirit rejects \/ even tho it's valid json. doh.
        $str = str_replace('\/','/',json_encode($response));
        print pack('N', strlen($str));
        print $str;
    }
    
    /**
     * Settings object for this resolver, reported when we start
     */
    public function getSettings()
    {
        $settings = (Object) array(
            '_msgtype' => 'settings',
            'name' => $this->name,
            'targettime' => $this->targetTime,
            'timeout' => $this->timeout,
            'weight' => $this->weight,
            'localonly' => isset($this->localonly) ? $this->localonly : TRUE,
        );
        return $settings;
    }
    
    public function log($message)
    {
        $fh = fopen("php://STDERR", 'w');
        fwrite($fh, $message . "\n");
        fclose($fh);
    }
    
    public function errorHandler($errno, $errstr, $errfile, $errline)
    {
        $exit = false;
        
        switch ($errno) {
            case E_USER_ERROR:
                $type = "Fatal";
                $exit = true;

            case E_WARNING:
            case E_USER_WARNING:
                $type = "Warning";
                break;

            case E_NOTICE:
            case E_USER_NOTICE:
                $type = "Notice";
                break;

            default:
                $type = "Unknown";
                break;
        }
        
        $format = 'PHP ' . $type . ' Error: "%s" (line %s in %s)';
        $error = sprintf($format, $errstr, $errline, $errfile);
        
        $this->log($error);
        
        if ($exit) {
            exit(1);
        }
        else {
            /* Don't execute PHP internal error handler */
            return true;
        }
    }
}


/**
  * A resolver for Youtube videos
  * @author Christian Muehlhaeuser (http://tomahawk-player.org)
  */
class YoutubeResolver extends PlaydarResolver
{
    protected $name = 'Youtube Resolver';
    protected $targetTime = 10; // fast atm, it's all hardcoded.
    protected $timeout = 25; // fast atm, it's all hardcoded.
    protected $weight = 75; // 1-100. higher means preferable.
    protected $m_urlOut = 'http://www.youtube.com/watch?v=%s';

    protected $maxResults = 25;
    
    public function resolve( $request )
    {
        // check for search keywords
        // trim whitespace
        // separate multiple keywords with /
        $query = $request->artist . " " . $request->track;
        $query = str_replace( ',', '/', trim( $query ) );
        $query = str_replace( ' ', '/', trim( $query ) );
        $query = urlencode( $query );

        // generate feed URL
        $feedURL = "http://gdata.youtube.com/feeds/api/videos/-/{$query}?orderby=viewCount&max-results={$this->maxResults}";

        // read feed into SimpleXML object
        $sxml = @simplexml_load_file( $feedURL );
        if ( !isset( $sxml ) )
            return array();

        // get summary counts from opensearch: namespace
        $counts = @$sxml->children( 'http://a9.com/-/spec/opensearchrss/1.0/' );
        $total = $counts->totalResults;
        $startOffset = $counts->startIndex;
        $endOffset = ( $startOffset - 1 ) + $counts->itemsPerPage;

        // iterate over entries in resultset
        foreach ( $sxml->entry as $entry )
        {
            // get nodes in media: namespace for media information
            $media = $entry->children( 'http://search.yahoo.com/mrss/' );

            // get video player URL
            $attrs = $media->group->player->attributes();
            $watch = $attrs['url'];

            // get video thumbnail
            $attrs = $media->group->thumbnail[0]->attributes();
            $thumbnail = $attrs['url'];

            // get <yt:duration> node for video length
            $yt = $media->children( 'http://gdata.youtube.com/schemas/2007' );
            $attrs = $yt->duration->attributes();
            $length = $attrs['seconds'];

            // get <gd:rating> node for video ratings
            $gd = $entry->children( 'http://schemas.google.com/g/2005' );
            if ( $gd->rating )
            {
                $attrs = $gd->rating->attributes();
                $rating = $attrs['average'];
            }
            else
            {
                $rating = 0;
            }

            preg_match( '/(\?|&)v=([0-9a-z_]+)(&|$)/si', $watch, $m );

            if ( !isset( $m[2] ) )
                return array();

            $v = $m[2];
            $ythtml = file_get_contents( $watch );
            $hash = '';

            if ( preg_match( '/var swfArgs( *)=( *)\{(.*?)\}/si', $ythtml, $m ) )
            {
                if ( preg_match( '/"t"( *):( *)"(.*?)"/si', $m[3], $mm ) )
                {
                    $hash = $mm[3];
                }
            }
            $url = sprintf( $this->m_urlOut, $v, $hash );
            $urlContents = file_get_contents( $url );

/*            $fp = fopen( "/tmp/tomahawk_youtube_debugoutput", "w+" );
            fwrite( $fp, $urlContents );
            flush( $fp );*/

            $magic = "fmt_stream_map=";
            $magicFmt = "18";
            $magicLimit = "%7C";
            $finalUrl = substr( $urlContents, strpos( $urlContents, $magic ) + strlen( $magic ), strlen( $urlContents ) );

//            $fp = fopen( "/tmp/tomahawk_youtube_debugoutput_v2", "w+" );
//            fwrite( $fp, $finalUrl . "\n\n\First pass:\n\n\n" );
            $finalUrl = substr( $finalUrl, strpos( $finalUrl, $magicFmt . $magicLimit ) + strlen( $magic . $magicLimit ), strlen( $finalUrl ) );
//            fwrite( $fp, $finalUrl . "\n\n\Second pass:\n\n\n" );
            $finalUrl = substr( $finalUrl, 0, strpos( $finalUrl, $magicLimit ) );
//            fwrite( $fp, $finalUrl . "\n\n\n" );
//            flush( $fp );

            $result = (Object) array(
                'artist' => $request->artist,
                'track' => $request->track,
                'source' => 'Youtube',
                'url' => "http://" . urldecode( $finalUrl ),
                'bitrate' => 0,
                'duration' => (int)$length,
                'score' => (float)1.0
            );

            return array( $result );
        }

        return array();
    }
}

$resolver = new YoutubeResolver();
$resolver->sendResponse( $resolver->getSettings() );
$resolver->handleRequest( fopen( "php://STDIN", 'r' ) );
