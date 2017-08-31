/* Zv.fm resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var ZvResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'ZV.fm',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    init: function() {
        //To populate Cookies
        Tomahawk.get("https://zv.fm/");
    },

    search: function (params) {
        var that = this;

        var query = params.query.replace(/\ /g, '+');

        return Tomahawk.get("https://zv.fm/mp3/search?keywords=" + query).then(function (response){
            var results = [];
            var trackRe = /href="\/artist[^"]+"><span>([^<]+).*?\/song\/[^"]+"><span>([^<]+)<[\s\S]*?data-time="([0-9]+)"\s+data-sid="([0-9]+)"/gm;
            var matches;
            while (matches = trackRe.exec(response)) {
                results.push({
                    type:       'track',
                    artist:     matches[1],
                    title:      matches[2],
                    track:      matches[2],
                    url:        'zvfm://' + matches[4],
                    duration:   matches[3],
                });
            }

            return results;
        });
    },

    getStreamUrl: function(params) {
        return {url: params.url.replace('zvfm://', 'https://zv.fm/download/')};
    },

    resolve: function (params) {
        var query = [ params.artist, params.track ].join(' - ');
        return this.search({query:query});
    }
});

Tomahawk.resolver.instance = ZvResolver;

