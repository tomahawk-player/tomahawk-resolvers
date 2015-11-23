/* http://music.163.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var NeteaseResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'netease',
        weight: 90,
        icon: '../images/logo.png',
        timeout: 15
    },

    getConfigUi: function () {
        return {
            "widget": Tomahawk.readBase64("config.ui"),
            fields: [{
                name: "quality",
                widget: "quality",
                property: "currentIndex"
            }]
        };
    },

    strQuality: ['lMusic', 'mMusic', 'hMusic'],//There are some additional formats like m4a in bMusic, etc
    numQuality: [96, 160, 320],

    newConfigSaved: function (newConfig) {
        var changed =
            this._quality != newConfig.quality;

        if (changed) {
            this.init();
        }
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artists[0].name,
            album:      entry.album.name,
            track:      entry.name,
            title:      entry.name,
            bitrate:    this.numQuality[this._quality],
            duration:   parseInt(entry.duration)/1000,
            url:        'netease://track/' + entry.id,
            checked:    true,
            type:       "track"
        };
    },

    init: function() {
        this.API_BASE = 'http://music.163.com/api/';
        this.SALT = '3go8&$8' + '*3*3h0k(2)2';
        var config = this.getUserConfig();
        this._quality = config.quality || 2;
    },

    _encrypt: function(input) {
        var xor_string = function ( str, key ) {
            var xored = "";
            var key_length = key.length;
            for (i=0; i<str.length;i++) {
                var a = str.charCodeAt(i) ^ key.charCodeAt(i % key_length);
                xored = xored+String.fromCharCode(a);
            }
            return xored;
        }
        return CryptoJS.enc.Base64.stringify(CryptoJS.MD5(xor_string(input, this.SALT))).replace(/\//g, '_').replace(/\+/g, '-');
    },

    getStreamUrl: function(params) {
        var that = this;
        var id = params.url.match(/^netease:\/\/([a-z]+)\/(.+)$/)[2];
        return this._apiCall('song/detail', {id:id, ids:'['+id+']'}).then(function(result){
            if(!result.code) {
                result = JSON.parse(result);
            }
            var format = that.strQuality[that._quality];
            var song = result.songs[0];
            if (!song[format])
            {
                //Requested quality not found , try to find the one going down
                //a step
                for(var i = that._quality; i >= 0 && !song[format]; --i) {
                    var format = that.strQuality[i];
                }
            }
            if (!song[format])
            {
                return {url:null};
            }
            var dfsid = song[format].dfsId.toString();
            var ext   =  song[format].extension;
            // m2.music.126.net is also working but is properly resolvable via
            // chinese DNS servers only, thus m5
            var url = 'http://m5.music.126.net/' + that._encrypt(dfsid) + '/' +
                dfsid + '.' + ext;
            return {url:url};
        });
    },

    _apiCall: function(endpoint, params) {
        return Tomahawk.post(this.API_BASE + endpoint, {data: params, headers: {
            'Referer' : this.API_BASE
        }});
    },

    search: function (params) {
        var that = this;

        return this._apiCall('search/get', {type:1, s:params.query, limit:100}).then(function(results){
            if(!results.result) {
                results = JSON.parse(results);
            }
            if(results.result.songCount > 0) {
                return results.result.songs.map(that._convertTrack, that);
            } else {
                return [];
            }
        });
    },

    resolve: function (params) {
        var query = [ params.artist, params.track ].join(' ');
        return this.search({query:query});
    }
});

Tomahawk.resolver.instance = NeteaseResolver;


