/*
 *   Copyright 2014, Lorenz Hübschle-Schneider <lorenz@4z2.de>
 *   Copyright 2014, Thierry Göckel <thierry@strayrayday.lu>
 *
 *   The MIT License (MIT)
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *   FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *   IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 *   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// DOMParser polyfill, slightly modified version of
// https://gist.github.com/eligrey/1129031 (public domain)
(function(DOMParser) {
    "use strict";
    var DOMParser_proto = DOMParser.prototype,
        real_parseFromString = DOMParser_proto.parseFromString;

    // Firefox/Opera/IE throw errors on unsupported types
    try {
        // WebKit returns null on unsupported types
        if ((new DOMParser()).parseFromString("", "text/html")) {
            // text/html parsing is natively supported
            return;
        }
    } catch (ex) {}

    DOMParser_proto.parseFromString = function(markup, type) {
        if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
            var doc = document.implementation.createHTMLDocument(""),
                doc_elt = doc.documentElement,
                first_elt;

            doc_elt.innerHTML = markup;
            first_elt = doc_elt.firstElementChild;

            if (doc_elt.childElementCount === 1 &&
                first_elt.localName.toLowerCase() === "html") {
                doc.replaceChild(first_elt, doc_elt);
            }

            return doc;
        } else {
            return real_parseFromString.apply(this, arguments);
        }
    };
}(DOMParser));


var Vibe3Resolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'vibe3',
        icon: '../images/icon.png',
        weight: 80,
        timeout: 10
    },
    init: function () {
        // Add URL handler for vibe3:// urls
        // We need this for adding the "Referer" header to the mp3 URL
        Tomahawk.addCustomUrlHandler("vibe3", "getStreamUrl", true);
    },
    resolve: function (qid, artist, album, title) {
        // build query
        var query = [title, artist].join(" ").trim(),
            url = "http://vibe3.com/searchProxy.php",
            that = this;

        // Vibe3 has issues with diacritics, remove them
        query = Tomahawk.removeDiacritics(query);

        // Send request
        Tomahawk.asyncRequest(url, function (xhr) {
            // parse xml
            var domParser = new DOMParser(),
                xmlDoc = domParser.parseFromString(xhr.responseText, "text/html"),
                tracks = xmlDoc.getElementsByTagName("li"),
                track, rawUrl, mp3url, artist, track_title, i,
                results = [];

            // check the response
            for (i = 0; i < tracks.length; i++) {
                track = tracks[i];
                // Need to access the URL via the download button instead of the player because the player
                // has 'display:none" and thus isn't available easily from the DOMParser
                rawUrl = track.getElementsByClassName('downloadButton')[0].getAttribute('onclick');
                // Return a vibe3:// URL instead of http so we can add the referer
                mp3url = rawUrl.replace(/.*'http:\/\//,'vibe3://').replace("?dl=1'",'');
                artist = track.getElementsByTagName('a')[0].textContent.trim();
                track_title = track.getElementsByClassName('songName')[0].textContent;
                // Trim away the artist-title-separator and extra spaces
                track_title = track_title.replace(' - ', '').trim();

                if ( artist !== "" && track_title !== "" && mp3url !== "" )
                {
                    results.push({
                        artist: artist,
                        track: track_title,
                        source: that.settings.name,
                        url: mp3url,
                        extension: 'mp3',
                        bitrate: 128,
                        score: 0.80
                    });
                }
            }
            Tomahawk.addTrackResults({
                qid: qid,
                results: results
            });
        }, {
            "Content-Type": "application/x-www-form-urlencoded"
        }, {
            method: "POST",
            data: "search=" + query
        });
    },
    getStreamUrl: function (qid, url) {
        // Add a referer header. This is required or vibe3's hotlink protection
        // will prevent us from retrieving the file
        url = url.replace("vibe3://", "http://");
        var headers = {
            "Referer": "http://vibe3.com"
        };
        Tomahawk.reportStreamUrl(qid, url, headers);
    },
    search: function (qid, searchString) {
        this.resolve( qid, searchString );
    }
});

Tomahawk.resolver.instance = Vibe3Resolver;
