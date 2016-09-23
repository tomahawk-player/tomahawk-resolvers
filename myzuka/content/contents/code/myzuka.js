/* Myzuka resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var MyzukaResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    apiLocation : 'https://myzuka.org/',

    settings: {
        cacheTime: 300,
        name: 'myzuka',
        weight: 80,
        icon: '../images/icon.png',
        timeout: 8
    },

    init: function() {
        Tomahawk.addCustomUrlHandler( 'myzuka', 'getStreamUrl', true );
    },

    search: function (query) {
        var that = this;

        var params = {
            q: query,
            p: '1',
            aux: 'PLA099'
        };

        return Tomahawk.get("https://go.mail.ru/search_site", {
            data: params
        }).then( function (response) {
            var results = [];
            var trackRe = /href="https?:\/\/myzuka.org\/(Song[^"]+)">([^<]+) - ([^<]+)[\s\S]*?:[^0-9]+([0-9]+,[0-9]+)[^:]+:\ +([0-9:]+)[^:]+:\ +([0-9]+)/gm;
            var matches;
            var tracks = response.substring(response.indexOf("result__banner"), response.length);
            while (matches = trackRe.exec(tracks)) {
                var time = matches[5].split(':');
                var min = parseInt(time[0]);
                var sec = parseInt(time[1]);
                results.push({
                    type:       'track',
                    artist:     matches[2],
                    title:      matches[3],
                    track:      matches[3],
                    url:        'myzuka://' + matches[1],
                    duration:   min * 60 + sec,
                    bitrate:    parseInt(matches[6]),
                    size:       parseFloat(matches[4].replace(",", ".")) * 1024 * 1024,
                });
            }

            return results;
        });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' ');
        return this.search(query);
    },

    _parseUrn: function (urn) {
        var match = urn.match( /^myzuka:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type: match[ 1 ],
            id:   match[ 2 ]
        };
    },

    getStreamUrl: function(qid, url) {
        var that = this;
        var songPageUrl = this.apiLocation + url.match(/^myzuka:\/\/(.+)$/)[1];
        Tomahawk.get(songPageUrl).then(function(response) {
            var mediaRe = /<a itemprop="audio" href="([^"]+)/gm;
            var match = mediaRe.exec(response);
            var streamUrl = match[1].replace(/&amp;/g, '&');
            if (streamUrl.substring(0, 4) != "http") {
                streamUrl = that.apiLocation + streamUrl;
            }
            Tomahawk.reportStreamUrl(qid, streamUrl);
        });
    }
});

Tomahawk.resolver.instance = MyzukaResolver;

