/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 * based on the the skeemr resolver  
 * (c) 2011 Dominik Schmidt <dev@dominik-schmidt.de>
 */

function getSettings()
{
    // prepare the return
    var response = new Object();
    response.name = "4shared Resolver";
    response.weight = 50;
    response.timeout = 10;

    return response;
}

function resolve( qid, artist, album, track )
{
    var valueForSubNode = function(node, tag)
    {
        return node.getElementsByTagName(tag)[0].textContent
    };

    // build query to 4shared
    var url = "http://search.4shared.com/network/searchXml.jsp?q=";
    var request = "";
    if(track != "" )
        request += track + " ";

    if(artist != "" )
        request += artist + " ";

    //no album ...
    //if(album != "" )
    //    url += "album_name=" + encodeURIComponent(album) + "&";
    
    url += encodeURIComponent(request)
    
    url += "&searchExtention=mp3&sortType=1&sortOrder=1&searchmode=3";
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
    if(xmlDoc.getElementsByTagName("result-files")[0].childNodes.length > 0)
    {
        var links = xmlDoc.getElementsByTagName("file");

        // walk through the results and store it in 'results'
        for(var i=0;i<links.length;i++)
        {
            var link = links[i];

            var result = new Object();
            result.artist = artist;
            result.album = album;
            result.track = track;
            //result.year = valueForSubNode(link, "year");

            result.source = "4shared";
            result.url = decodeURI(valueForSubNode(link, "flash-preview-url"));
    
            result.extension = "mp3";
            //result.bitrate = valueForSubNode(link, "bitrate")/1000;
            result.bitrate = 128;
            //result.duration = valueForSubNode(link, "duration");
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
