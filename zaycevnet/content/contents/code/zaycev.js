/* zaycevnet.info resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var ZaycevResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'zaycevnet',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    decodeSongID: function(song_id) {
        song_id = decodeURIComponent(song_id).replace(/[\-_]/gi, '');
        var alphabet = song_id.substr(0, 16);
        song_id = song_id.substr(16);
        song_id = strtr(song_id, alphabet, '0123456789abcdef');
        //I'm sure there should be less awkward way to get the raw final string
        //with CryptoJS
        song_id = CryptoJS.RC4.encrypt(CryptoJS.enc.Hex.parse(song_id), CryptoJS.enc.Latin1.parse(this.keyd));
        song_id = CryptoJS.enc.Base64.parse(song_id.toString()).toString(CryptoJS.enc.Latin1);
        return song_id;
    },

    _convertTrack: function (entry) {
        return {
            artist:     Tomahawk.htmlDecode(entry.artist.name),
            track:      Tomahawk.htmlDecode(entry.name),
            title:      Tomahawk.htmlDecode(entry.name),
            duration:   entry.length,
            url:        'zaycev://' + entry.uid,
            checked:    true,
            type:       "track",
        };
    },

    init: function() {
        var that = this;

        return Tomahawk.get("http://zaycevnet.info/").then(function (response){
            var keyRe = /var\ +keyd\ *=[^"]+"([^"]+)/gm;
            var hostRe = /[\.\ ]api_host\ *=[^"]+"([^"]+)/gm;
            that.keyd = keyRe.exec(response)[1];
            that.api_location = 'http://' + hostRe.exec(response)[1] + '/';
        });
    },

    search: function (params) {
        var that = this;

        return Tomahawk.get("http://zaycevnet.info/term/" + params.query).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            return response.map(that._convertTrack, that);
        });
    },

    resolve: function (params) {
        var query = [ params.artist, params.track ].join(' - ');
        return this.search({query:query});
    },

    getStreamUrl: function(params) {
        var that = this;
        var id = this.decodeSongID(params.url.split('://')[1]);
        return Tomahawk.get(this.api_location + 'audio.getlinks/', {
            data: {
                proxy: '4',
                id: id,
                format: 'jsongz',
                hash: id
            }
        }).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            if(response.status == 'ok')
                return {url:response.result[0].url};
            else
                return {url:null};
        });
    }
});

Tomahawk.resolver.instance = ZaycevResolver;
