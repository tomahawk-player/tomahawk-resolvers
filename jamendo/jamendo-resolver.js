/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 * based on the the skeemr resolver  
 * (c) 2011 Dominik Schmidt <dev@dominik-schmidt.de>
 */

function getSettings()
{
    // prepare the return
    var response = new Object();
    response.name = "Jamendo Resolver";
    response.weight = 85;
    response.timeout = 10;

    return response;
}

function resolve( qid, artist, album, track )
{
    var valueForSubNode = function(node, tag)
    {
        return node.getElementsByTagName(tag)[0].textContent
    };

    // build query to Jamendo
    var url = "http://api.jamendo.com/get2/id+name+duration+stream+album_name+album_url+artist_name+artist_url/track/xml/track_album+album_artist/?";
    if(track != "" )
        url += "name=" + encodeURIComponent(track) + "&";

    if(artist != "" )
        url += "artist_name=" + encodeURIComponent(artist) + "&";

    if(album != "" )
        url += "album_name=" + encodeURIComponent(album) + "&";

    url += "n=all";
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
    if(xmlDoc.getElementsByTagName("data")[0].childNodes.length > 0)
    {
        var links = xmlDoc.getElementsByTagName("track");

        // walk through the results and store it in 'results'
        for(var i=0;i<links.length;i++)
        {
            var link = links[i];

            var result = new Object();
            result.artist = valueForSubNode(link, "artist_name");
            result.album = valueForSubNode(link, "album_name");
            result.track = valueForSubNode(link, "name");
            //result.year = valueForSubNode(link, "year");

            result.source = "Jamendo";
            result.url = decodeURI(valueForSubNode(link, "stream"));
            // jamendo also provide ogg ?
            result.extension = "mp3";
            //result.bitrate = valueForSubNode(link, "bitrate")/1000;
            result.duration = valueForSubNode(link, "duration");
            result.score = 1.0;

            results.push(result);
        }
    }

    // prepare the return
    var response = new Object();
    response.qid = qid;
    response.results = results;

    return response;
}

