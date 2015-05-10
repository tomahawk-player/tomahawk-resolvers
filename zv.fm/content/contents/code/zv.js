/* Zv.fm resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var ZvResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
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
        Tomahawk.get("http://zv.fm");
        //We use custom url handler instead of returning plain http links cause
        //that site uses weird redirects which work perfectly fine with
        //Tomahawk but not with VLC
        Tomahawk.addCustomUrlHandler( 'zvfm', 'getStreamUrl', true );
    },

    search: function (query) {
        var that = this;

        query = query.replace(/\ /g, '+');

        return Tomahawk.get("http://zv.fm/mp3/search?keywords=" + query).then(function (response){
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

    getStreamUrl: function(qid, url) {
        Tomahawk.reportStreamUrl(qid, url.replace('zvfm://', 'http://zv.fm/download/'));
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' - ');
        return this.search(query);
    }
});

Tomahawk.resolver.instance = ZvResolver;

