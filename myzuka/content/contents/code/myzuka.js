/* Myzuka resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var MyzukaResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    apiLocation : 'https://myzuka.me/',

    settings: {
        cacheTime: 300,
        name: 'myzuka',
        weight: 80,
        icon: '../images/icon.png',
        timeout: 8
    },

    search: function (param) {
        var that = this;

        var params = {
            searchText: param.query
        };

        return Tomahawk.get(this.apiLocation + "Search", {
            data: params
        }).then( function (response) {
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

    resolve: function (params) {
        var query = [ params.artist, params.album, params.track ].join(' ');
        return this.search({query:query});
    },

    _parseUrn: function (urn) {
        var match = urn.match( /^myzuka:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type: match[ 1 ],
            id:   match[ 2 ]
        };
    },

    getStreamUrl: function(params) {
        var that = this;
        var songPageUrl = this.apiLocation + params.url.match(/^myzuka:\/\/(.+)$/)[1];
        return Tomahawk.get(songPageUrl).then(function(response) {
            var mediaRe = /<a itemprop="audio" href="([^"]+)/gm;
            var match = mediaRe.exec(response);
            var streamUrl = match[1].replace(/&amp;/g, '&');
            if (streamUrl.substring(0, 4) != "http") {
                streamUrl = that.apiLocation + streamUrl;
            }
            return {url: streamUrl};
        });
    }
});

Tomahawk.resolver.instance = MyzukaResolver;

