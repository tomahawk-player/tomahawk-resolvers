/*
 * (c) 2011 Dominik Schmidt <dev@dominik-schmidt.de>
 *          Christian Muehlhaeuser <muesli@tomahawk-player.org>
 */

function getSettings()
{
    // prepare the return
    var response = new Object();
    response.name = "AOL Music Resolver";
    response.weight = 80;
    response.timeout = 10;

    return response;
}


function resolve(qid, artist, album, song)
{
    var url = "http://music.aol.com/api/audio/search?songTitle="+ encodeURI(song) + "&artistName=" + encodeURI(artist);

    // send request and parse it into javascript
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.open('GET', url, false);
    xmlHttpRequest.send(null);
    //console.log(xmlHttpRequest.responseText);
    var obj = eval('(' + xmlHttpRequest.responseText + ')');

    // check the repsonse
    if(obj.response.statusText == "Ok")
    {
        // walk through the results (called assets by aol) and store it in 'results'
        var results = new Array();
        for ( var i = 0; i < obj.response.data.totalFound; i++ )
        {
            var asset = obj.response.data.assets[i];
            if ( asset.enclosure == '' || asset.enclosure.indexOf( "tumblr.com" ) >= 0 )
            {
                continue;
            }

            var result = new Object();
            result.artist = asset.artistname;
            result.track = asset.songtitle;
            result.source = "AOL Music Search";
            result.url = asset.enclosure;
            result.bitrate = "";
            result.duration = asset.duration;
            result.score = 1.0;
            result.extension = "mp3";

            results.push(result);
        }

        // prepare the return
        var response = new Object();
        response.qid = qid;
        response.results = results;

        return response;
    }

    console.log("status: not ok");
    return false;
}

/*
//var qid = 1337;
//var artist = "Iron Maiden";
//var album =  "";
//var song = "Wasting Love";
var qid = phantom.args[0];
var artist = phantom.args[1];
var album = "";
var song = phantom.args[3];

var resolved = resolve(qid, artist, album, song);
if(resolved)
{
    console.log("success");
    console.log("qid:" + resolved.qid);
    for(var i=0;i<resolved.results.length;i++)
    {
        var curItem = resolved.results[i];
        console.log("    "+ curItem.artist + " - " + curItem.track + " ( " + curItem.url + " )");
    }
} else {
  console.log("failure");
}
*/