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
    response.blockedServices = new Array();
    response.blockedServices.push("dreammedia.ru");

    return response;
}


function resolve( qid, artist, album, track )
{
    var valueForSubNode = function(node, tag)
    {
        return node.getElementsByTagName(tag)[0].textContent
    };

    var isFromService = function(url, services)
    {
        for(var i=0;i<services.length;i++)
        {
            if(url.indexOf(services[i]) >= 0)
            {
                return true;
            }
        }
        return false;
    }

    // build query to skreemr
    var url = "http://skreemr.com/skreemr-web-service/search?";
    if(track != "" )
        url += "song=" + encodeURIComponent(track) + "&";

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

            // if the blocked service is a substr of url dont add it to the results
            if(isFromService(valueForSubNode(link, "url"), getSettings().blockedServices))
                continue;

            var result = new Object();
            result.artist = valueForSubNode(link, "artist");
            result.album = valueForSubNode(link, "album");
            result.track = valueForSubNode(link, "songtitle");
            result.year = valueForSubNode(link, "year");

            result.source = "Skreemr";
            result.url = decodeURI(valueForSubNode(link, "url"));
            // skreemr only searches mp3s atm
            result.extension = "mp3";
            result.bitrate = valueForSubNode(link, "bitrate")/1000;
            result.durationString = valueForSubNode(link, "duration");
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
