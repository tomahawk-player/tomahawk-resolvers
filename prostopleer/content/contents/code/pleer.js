/* pleer.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

// Copied from vibe3.js resolver
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

var ProstopleerResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'prostopleer',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    init: function() {
        Tomahawk.addCustomUrlHandler( 'prostopleer', 'getStreamUrl', true );
    },

    search: function (query) {
        var that = this;

        query = query.replace(/\ /g, '+');

        return Tomahawk.get("http://pleer.com/search?q=" + query).then(function (response){
            // parse xml
            var domParser = new DOMParser();
            var xmlDoc = domParser.parseFromString(response, "text/html");
            var result_divs = xmlDoc.getElementsByTagName("li");

            var results = [];

            for (var i = 0; i < result_divs.length; i++) {
                var track = result_divs[i];
                if(track.hasAttribute('file_id')) {
                    results.push({
                        type:       'track',
                        artist:     track.getAttribute('singer'),
                        title:      track.getAttribute('song'),
                        track:      track.getAttribute('song'),
                        url:        'prostopleer://' + track.getAttribute('link'),
                        duration:   parseInt(track.getAttribute('duration')),
                        size:       parseFloat(track.getAttribute('size').split(' ')[0]) * 1024 * 1024,
                        bitrate:    parseInt(track.getAttribute('rate').split(' '))
                    });
                }
            }
            return results;
        });
    },

    getStreamUrl: function(qid, url) {
        Tomahawk.post('http://pleer.com/site_api/files/get_url',{
                    data: {action: 'play', id: url.split('://')[1]}
                }).then(function (result){
                    Tomahawk.reportStreamUrl(qid, result.track_link);
                });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' - ');
        return this.search(query);
    }
});

Tomahawk.resolver.instance = ProstopleerResolver;

