/* zaycevnet.info resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var ZaycevResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'zaycevnet',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    rc4: function (key, str) {
        var s = [],
            j = 0,
            x, res = '';
        for (var i = 0; i < 256; i++) {
            s[i] = i;
        }
        for (i = 0; i < 256; i++) {
            j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
            x = s[i];
            s[i] = s[j];
            s[j] = x;
        }
        i = 0;
        j = 0;
        for (var y = 0; y < str.length; y++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            x = s[i];
            s[i] = s[j];
            s[j] = x;
            res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
        }
        return res;
    },

    strtr: function (str, from, to) {
        var result = "";
        for (var i in str) {
            var char = str[i];
            var num = from.indexOf(char);
            result += to[num];
        }
        return result;
    },

    hex2bin: function (hex) {
        var bytes = [],
            str;
        for (var i = 0; i < hex.length - 1; i += 2)
            bytes.push(parseInt(hex.substr(i, 2), 16));
        return String.fromCharCode.apply(String, bytes);
    },

    decodeSongID: function(song_id) {
        song_id = decodeURIComponent(song_id);
        song_id = song_id.replace(/[\-_]/gi, '');
        var alphabet = song_id.substr(0, 16);
        song_id = song_id.substr(16);
        song_id = this.strtr(song_id, alphabet, '0123456789abcdef');
        var key = this.keyd;
        song_id = this.hex2bin(song_id);
        song_id = this.rc4(key, song_id);
        return song_id;
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist.name,
            track:      entry.name,
            title:      entry.name,
            duration:   entry.length,
            url:        'zaycev://' + entry.uid,
            checked:    true,
            type:       "track",
        };
    },

    init: function() {
        var that = this;
        Tomahawk.addCustomUrlHandler( 'zaycev', 'getStreamUrl', true );

        return Tomahawk.get("http://zaycevnet.info/").then(function (response){
            var keyRe = /var\ +keyd\ *=[^"]+"([^"]+)/gm;
            var hostRe = /[\.\ ]api_host\ *=[^"]+"([^"]+)/gm;
            that.keyd = keyRe.exec(response)[1];
            that.api_location = 'http://' + hostRe.exec(response)[1] + '/';
        });
    },

    search: function (query) {
        var that = this;

        return Tomahawk.get("http://zaycevnet.info/term/" + query).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            return response.map(that._convertTrack, that);
        });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' - ');
        return this.search(query);
    },

    getStreamUrl: function(qid, url) {
        var that = this;
        var id = this.decodeSongID(url.split('://')[1]);
        Tomahawk.get(this.api_location + 'audio.getlinks/', {
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
                Tomahawk.reportStreamUrl(qid, response.result[0].url);
            else
                Tomahawk.reportStreanUrl(qid, '');
        });
    }
});

Tomahawk.resolver.instance = ZaycevResolver;

