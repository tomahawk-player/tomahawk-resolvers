/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */
var OfficialfmResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Official.fm',
        weight: 70,
        timeout: 5
    },
    process: function (qid, artist, album, title, strict) {
        var applicationKey = "ixHOUAG9r9csybvGtGuf";

        var valueForSubNode = function (node, tag) {
                return node.getElementsByTagName(tag)[0].textContent;
            };

        // build query to Official.fm
        var url = "http://api.official.fm/search/tracks/";
        var request = "";
        if (title !== "") request += title + " ";

        if (artist !== "") request += artist + " ";

        url += encodeURIComponent(request);

        url += "?key=" + applicationKey;
        Tomahawk.log(url);
        // send request and parse it into javascript
        var that = this;
        Tomahawk.asyncRequest(url, function(xhr) {
            // parse xml
            var domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(xhr.responseText, "text/xml");

            var results = new Array();
            var r = xmlDoc.getElementsByTagName("tracks");
            // check the response
            if (r.length > 0 && r[0].childNodes.length > 0) {
                var links = xmlDoc.getElementsByTagName("track");

                // walk through the results and store it in 'results'
                for (var i = 0; i < links.length; i++) {
                    var link = links[i];
                    var result = new Object();
                    result.artist = valueForSubNode(link, "artist_string");
                    result.album = album;
                    result.track = valueForSubNode(link, "title");

                    result.source = that.settings.name;
                    result.duration = valueForSubNode(link, "length");
                    result.score = 0.95;
                    result.id = valueForSubNode(link, "id");
                    if (!strict || (result.artist == artist && result.track == title)) {
                        var urlStream = 'http://api.official.fm/track/' + result.id + '/stream?key=' + applicationKey + "&format=json";

                        var t = JSON.parse(Tomahawk.syncRequest(urlStream));
                        result.url = t.stream_url;
                        result.mimetype = "audio/mpeg";
                        results.push(result);
                    }
                }
            }
            var return1 = {
                qid: qid,
                results: results
            };
            Tomahawk.addTrackResults(return1);
        });
    },
    resolve: function (qid, artist, album, title) {
        this.process(qid, artist, album, title, true);
    },
    search: function (qid, searchString) {
        this.process(qid, "", "", searchString, false);
    }
});

Tomahawk.resolver.instance = OfficialfmResolver;