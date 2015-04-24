/* Myzuka resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var MyzukaResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    api_location : 'https://myzuka.org/',

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
            searchText: query
        };

        return Tomahawk.get(this.api_location + "Search", {
            data: params
        }).then( function (response) {
            //return response.items.map(that._convertTrack, that);
            var results = [];
            var trackRe = /<a\ +href="\/Artist\/[^"]+">([^<]+)<[\s\S]*?<a\ +href="\/?(Song[^"]+)">([^<]+)/gm;
            var tracks = response.substring(response.indexOf("Поиск по композициям"), response.length);
            var matches;
            while (matches = trackRe.exec(tracks)) {
                results.push({
                    type: 'track',
                    artist: matches[1],
                    title: matches[3],
                    track: matches[3],
                    url: 'myzuka://' + matches[2],
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
        var songPageUrl = this.api_location + url.match(/^myzuka:\/\/(.+)$/)[1];
        Tomahawk.get(songPageUrl).then(function(response) {
            var mediaRe = /<a itemprop="audio" href="([^"]+)/gm;
            var match = mediaRe.exec(response);
            Tomahawk.log(JSON.stringify(match));
            var streamUrl = match[1].replace(/&amp;/g, '&');
            if (streamUrl.substring(0, 4) != "http") {
                streamUrl = that.api_location + streamUrl;
            }
            Tomahawk.reportStreamUrl(qid, streamUrl);
        });
    }
});

Tomahawk.resolver.instance = MyzukaResolver;

