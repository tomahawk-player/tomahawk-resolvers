/*
 * (c) 2011 Christian Muehlhaeuser <muesli@tomahawk-player.org>
 *
 */

function getSettings()
{
    // Initialize the resolver
    var response = new Object();
    response.name = "JavaScript Example Resolver";
    response.weight = 50;
    response.timeout = 5;

    return response;
}


function resolve( qid, artist, album, track )
{
    var result = new Object();
    result.artist = artist;
    result.album = album;
    result.track = track;
    result.source = "Mokele.co.uk";
    result.url = "http://play.mokele.co.uk/music/Hiding%20In%20Your%20Insides.mp3";
    result.bitrate = 160;
    result.duration = 248;
    result.size = 4971780;
    result.score = 1.0;
    result.extension = "mp3";
    result.mimetype = "audio/mpeg";

    var results = new Array();
    results.push( result );

    // prepare the response
    var response = new Object();
    response.qid = qid;
    response.results = results;

    return response;
}
