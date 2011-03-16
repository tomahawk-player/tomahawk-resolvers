/*
 * (c) 2011 Dominik Schmidt <dev@dominik-schmidt.de>
 */

function getSettings()
{
    // prepare the return
    var response = new Object();
    response.name = "Skreemr Resolver";
    response.weight = 85;
    response.timeout = 10;

    return response;
}


function resolve( qid, artist, album, song )
{
    var valueFromLinkNode = function(node, key)
    {
        return node.getElementsByTagName(key)[0].textContent
    };

    // build query to skreemr
    var url = "http://skreemr.com/skreemr-web-service/search?";
    if(song != "" )
        url += "song=" + encodeURIComponent(song) + "&";

    if(artist != "" )
        url += "artist=" + encodeURIComponent(artist) + "&";

    if(album != "" )
        url += "album=" + encodeURIComponent(album) + "&";

    // send request and parse it into javascript
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.open('GET', url, false);
    xmlHttpRequest.send(null);
    var xmlString = xmlHttpRequest.responseText;

    // parse xml
    var domParser = new DOMParser();
    xmlDoc = domParser.parseFromString(xmlString, "text/xml");

    var results = new Array();
    // check the repsonse
    if(xmlDoc.getElementsByTagName("links")[0].childNodes.length > 0)
    {
        var links = xmlDoc.getElementsByTagName("link");

        // walk through the results (called assets by aol) and store it in 'results'
        for(var i=0;i<links.length;i++)
        {
            var link = links[i];
            var result = new Object();
            result.artist = valueFromLinkNode(link, "artist");
            result.album = valueFromLinkNode(link, "album");
            result.track = valueFromLinkNode(link, "songtitle");
            result.year = valueFromLinkNode(link, "year");

            result.source = "Skreemr";
            result.url = decodeURI(valueFromLinkNode(link, "url"));
            // skreemr only searches mp3s atm
            result.extension = "mp3";
            result.bitrate = valueFromLinkNode(link, "bitrate")/1000;
            result.durationString = valueFromLinkNode(link, "duration");
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
