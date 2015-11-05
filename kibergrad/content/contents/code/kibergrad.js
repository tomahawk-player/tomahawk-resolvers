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

    init: function() {
        //LRU Cache for album titles
        this.cache = new LRUCache(1000);
        Tomahawk.log(this.cache);
    },

    _resolveAlbumName: function (id, cache) {
        var that = this;
        return Tomahawk.get('http://m.kibergrad.com/' + id + '/abcde/abcde').then(function (response){
            var TitleRe = /<title>(.+)<\/title>/gm;
            var ArtistRe = /class="cover-artist">\s*([^<]+?)\s*</gm;
            try {
                var album = TitleRe.exec(response)[1];
                var artist = ArtistRe.exec(response)[1];
                cache.put(id, {album: album, artist: artist});
            } catch (e) {
                cache.put(id, {album: null, artist: null});
            }
        }, function (error) { cache.put(id, ''); });
    },

    _processTracks: function (songsList, cache, trackInfo) {
        var that = this;
        var results = [];
        for(var i=0; i < songsList.length; ++i) {
            var track = songsList[i];
            var albumTitle = cache.get(track.albumId);
            if (typeof albumTitle === 'undefined') {
                return that._resolveAlbumName(track.albumId, cache).then(function (response){
                    return that._processTracks(songsList, cache, trackInfo);
                });
            }
            var artist = albumTitle.artist;
            var title = track.name;
            var album = albumTitle.album;

            if (typeof trackInfo !== 'undefined') {
                //Kibergrad eats special characters so we're here to workaround
                //that
                // (ie if name is "foo & bar" and kibergrad says "foo  bar"
                // we'll pretend its "foo & bar"
                var re = /[&\\\/\ \.\?\!\{\}\[\]\*\%\(\)\@\$\-\=\+\,]/gi;
                if (artist.toLowerCase().replace(re, '') == trackInfo.artist.toLowerCase().replace(re, ''))
                    artist = trackInfo.artist;
                if (title.toLowerCase().replace(re, '') == trackInfo.title.toLowerCase().replace(re, ''))
                    title = trackInfo.title;
                if (album.toLowerCase().replace(re, '') == trackInfo.album.toLowerCase().replace(re, ''))
                    album = trackInfo.album;
            }

            results.push({
                artist:     artist,
                track:      title,
                title:      title,
                album:      album,
                size:       track.size,
                duration:   track.duration,
                bitrate:    track.bitrate,
                //url:        CryptoJS.enc.Base64.parse(track.base64).toString(CryptoJS.enc.Latin1),
                url:        'http://kibergrad.com/api/song/download/' + track.id + '.mp3',
                checked:    true,
                type:       "track",
            });
        }
        return results;
    },

    search: function (params, trackInfo) {
        var that = this;

        return Tomahawk.get("http://m.kibergrad.com/search?q=" + params.query,
            {headers: { 'X-Requested-With' : 'XMLHttpRequest' } }).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            if (!response.success)
                return [];
            return that._processTracks(response.songsList, that.cache, trackInfo);
        });
    },

    resolve: function (params) {
        var query = [ params.artist, params.track ].join(' - ');
        var trackInfo = {
            title: params.track,
            artist: params.artist,
            album: params.album
        };
        return this.search({query:query}, trackInfo);
    }
});

Tomahawk.resolver.instance = KibergradResolver;

