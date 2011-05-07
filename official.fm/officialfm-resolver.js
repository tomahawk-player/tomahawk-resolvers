/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 * based on the the skeemr resolver  
 * (c) 2011 Dominik Schmidt <dev@dominik-schmidt.de>
 */

function getSettings()
{
    // prepare the return
    var response = new Object();
    response.name = "Official.fm Resolver";
    response.weight = 85;
    response.timeout = 10;

    return response;
}

function resolve( qid, artist, album, track )
{
    var applicationKey = "ixHOUAG9r9csybvGtGuf";
    
    var valueForSubNode = function(node, tag)
    {
        return node.getElementsByTagName(tag)[0].textContent
    };

    // build query to Official.fm
    var url = "http://api.official.fm/search/tracks/";
    var request = "";
    if(track != "" )
        request += track + " ";

    if(artist != "" )
        request += artist + " ";

    //if(album != "" )
    //    url += "album_name=" + encodeURIComponent(album) + "&";
    
    url += encodeURIComponent(request)
    
    url += "?key=" + applicationKey;
    // send request and parse it into javascript
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.open('GET', url, false);
    xmlHttpRequest.send(null);
    var xmlString = xmlHttpRequest.responseText;

    // parse xml
    var domParser = new DOMParser();
    xmlDoc = domParser.parseFromString(xmlString, "text/xml");

    var results = new Array();
    // check the response
    if(xmlDoc.getElementsByTagName("tracks")[0].childNodes.length > 0)
    {
        var links = xmlDoc.getElementsByTagName("track");

        // walk through the results and store it in 'results'
        for(var i=0;i<links.length;i++)
        {
            var link = links[i];

            var result = new Object();
            result.artist = valueForSubNode(link, "artist_string");
            result.album = album;
            result.track = valueForSubNode(link, "title");

            result.source = "Official.fm";
            //result.bitrate = valueForSubNode(link, "bitrate")/1000;
            result.duration = valueForSubNode(link, "length");
            result.score = 1.0;
            result.id = valueForSubNode(link, "id");
            if(result.artist == artist && result.track == track) {           
                var xmlHttpRequestStream = new XMLHttpRequest();
                var urlStream = 'http://api.official.fm/track/'+result.id+'/stream?key='+applicationKey+"&format=json";
                xmlHttpRequestStream.open('GET', urlStream, false);
                xmlHttpRequestStream.send(null);
                var jsonString = xmlHttpRequestStream.responseText;
                var t = eval('(' + jsonString + ')');
                result.url = t.stream_url;
                result.mimetype = "audio/mpeg";
                results.push(result);
            }
        }
    }

    // prepare the return
    var response = new Object();
    response.qid = qid;
    response.results = results;

    return response;
}