function getSettings() {
    var settings = new Object();
    settings.name = "Youtube Resolver";
    settings.weight = 50;
    settings.timeout = 5;
    settings.maxResults = 5;

    return settings;
}

function resolve(qid, artist, album, track) {

    var properties = getSettings();

    if (artist !== "") {
        query = encodeURIComponent(artist) + "+";
    }
    if (track !== "") {
        query += encodeURIComponent(track);
    }
    var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q=" + query + "&v=2&alt=jsonc&max-results=" + properties.maxResults;
    apiQuery = apiQuery.replace(/\%20/g, '\+');

    var myJsonObject = {};
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', apiQuery, false);
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            myJsonObject = JSON.parse(httpRequest.responseText);
        }
    }
    httpRequest.send(null);

    var syncRequest = function (videoUrl) {
            var xmlHttpRequest = new XMLHttpRequest();
            xmlHttpRequest.open('GET', videoUrl, false);
            xmlHttpRequest.send(null);
            return xmlHttpRequest.responseText;
        }

    var decodeurl = function (url) {
        // Some crazy replacement going on overhere! lol
        return url.replace(/%25252C/g, ",").replace(/%20/g, " ").replace(/%3A/g, ":").replace(/%252F/g, "/").replace(/%253F/g, "?").replace(/%252C/g, ",").replace(/%253D/g, "=").replace(/%2526/g, "&").replace(/%26/g, "&").replace(/%3D/g, "=");

        };


    var parseVideoUrlFromYtPage = function (html) {
            var magic = "url_encoded_fmt_stream_map=";
            var magicFmt = "18";
            var magicLimit = "fallback_host";
            var pos = html.indexOf(magic) + magic.length;
            html = html.slice(pos);
            html = html.slice(html.indexOf(magicFmt + magicLimit) + (magic + magicLimit).length);
            finalUrl = html.slice(0, html.indexOf(magicLimit));
            return "http://o-o.preferred." + decodeurl(finalUrl);
        }


    var results = new Array();
    if (myJsonObject.data.totalItems > 0) {
        for (i = 0; i < myJsonObject.data.totalItems && i < properties.maxResults; i++) {

            // Need some more validation here
            // This doesnt help it seems, or it just throws the error anyhow, and skips?
            if(myJsonObject.data.items[i] === undefined)
                continue;
            if(myJsonObject.data.items[i].duration === undefined)
                continue;
            var result = new Object();
            result.artist = artist;
            result.track = track;
            //result.year = ;
            result.source = properties.name;
            var urlContents = syncRequest(myJsonObject.data.items[i].player['default']);
            result.url = parseVideoUrlFromYtPage(urlContents);
            result.mimetype = "video/h264";
            //result.bitrate = 128;
            result.duration = myJsonObject.data.items[i].duration;
            result.score = 1.00;
            results.push(result);

        }
    }
    var response = new Object();
    response.qid = qid;
    response.results = results;
    return response;
}
