/* pleer.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var ProstopleerResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'prostopleer',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 15
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist,
            track:      entry.track,
            title:      entry.track,
            size:       entry.size,
            duration:   entry.length,
            bitrate:    parseInt(entry.bitrate.split(' ')[0]),
            url:        entry.file,
            checked:    true,
            type:       "track",
        };
    },

    search: function (query) {
        var that = this;

        query = query.replace(/\ /g, '+');

        return Tomahawk.get("http://pleer.com/browser-extension/search?q=" + query).then(function (response){
            return response.tracks.map(that._convertTrack, that);
        });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' - ');
        return this.search(query);
    }
});

Tomahawk.resolver.instance = ProstopleerResolver;

