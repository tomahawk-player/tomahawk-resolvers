/* Kibergrad,com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var KibergradResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'Kibergrad',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    search: function (params) {
        var that = this;

        return Tomahawk.get("https://kiber.me/search?q=" + params.query,
            {}).then(function (response){
            var results = [];
            var trackRe = /<span.+?data-url="([^"]+)".+?data-title="([^"]+)".+?data-artist="([^"]+)"/gm;
            var matches;
            while (matches = trackRe.exec(response)) {
                results.push({
                    type:       'track',
                    artist:     Tomahawk.htmlDecode(matches[3]),
                    title:      Tomahawk.htmlDecode(matches[2]),
                    track:      Tomahawk.htmlDecode(matches[2]),
                    url:        "kiber://" + matches[1],
                });
            }

            return results;
        });
    },

    getStreamUrl: function(params) {
        return {url: params.url.replace('kiber://', 'https://kiber.me')};
    },

    resolve: function (params) {
        var query = [ params.artist, params.track ].join(' - ');
        return this.search({query:query});
    }
});

Tomahawk.resolver.instance = KibergradResolver;

