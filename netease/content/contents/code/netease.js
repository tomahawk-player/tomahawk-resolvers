/* http://music.163.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var api_to_extend = Tomahawk.Resolver.Promise; //Old 0.9
if(typeof api_to_extend === 'undefined')
    api_to_extend = Tomahawk.Resolver; //New 0.9

var NeteaseResolver = Tomahawk.extend( api_to_extend, {
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
        this.SALT = '3go8&$8*3*3h0k(2)2';
        //Needed for old 0.9
        Tomahawk.addCustomUrlHandler( 'netease', 'getStreamUrl', true );
        var config = this.getUserConfig();
        this._quality = config.quality;
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

    getStreamUrl: function(qid, url) {
        var newAPI = false;
        Tomahawk.log(qid);
        Tomahawk.log(url);
        if(qid.url) {
            //new 0.9
            url = qid.url;
            newAPI = true;
        }
        Tomahawk.log(url);
        var that = this;
        var id = url.match(/^netease:\/\/([a-z]+)\/(.+)$/)[2];
        return this._apiCall('song/detail', {id:id, ids:'['+id+']'}).then(function(result){
            if(!result.code)
                result = JSON.parse(result);
            var format = that.strQuality[that._quality];
            var dfsid = result.songs[0][format].dfsId.toString();
            var ext   =  result.songs[0][format].extension;
            var url = 'http://m1.music.126.net/' + that._encrypt(dfsid) + '/' +
                dfsid + '.' + ext;
            if(newAPI)
                return {url:url};
            else
                Tomahawk.reportStreamUrl(qid, url);
        });
    },

    _apiCall: function(endpoint, params) {
        return Tomahawk.post(this.API_BASE + endpoint, {data: params, headers: {
            'Referer' : this.API_BASE
        }});
    },

    search: function (query) {
        var that = this;

        if(query.hasOwnProperty('query'))
            query = query.query; //New 0.9

        return this._apiCall('search/get', {type:1, s:query, limit:100}).then(function(results){
            if(!results.result)
                results = JSON.parse(results);
            return results.result.songs.map(that._convertTrack, that);
        });
    },

    resolve: function (artist, album, track) {
        if(artist.hasOwnProperty('artist'))
        {
            //New 0.9
            artist = artist.artist;
            album = artist.album;
            track = artist.track;
        }
        var query = [ artist, track ].join(' ');
        return this.search({query:query});
    }
});

Tomahawk.resolver.instance = NeteaseResolver;


