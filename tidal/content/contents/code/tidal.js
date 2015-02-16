/* Tidal resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 *
 * To the extent possible under law, the author(s) have dedicated all
 * copyright and related and neighboring rights to this software to
 * the public domain worldwide. This software is distributed without
 * any warranty.
 *
 * You should have received a copy of the CC0 Public Domain Dedication
 * along with this software. If not, see:
 * http://creativecommons.org/publicdomain/zero/1.0/
 */
debugMode = false;

function xhrRequest(url, method, data, callback){
    var xhr = new XMLHttpRequest()

    if (debugMode == true) { Tomahawk.log('Sending request:' + url + '?' + data); }

    if(method == "POST"){
        xhr.open(method, url, true)
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
        xhr.send(data)
    } else {
        if(url.match(/\?/))
            xhr.open(method, url+'&'+data, true)
        else
            xhr.open(method, url+'?'+data, true)

        xhr.send()
    }

    xhr.onreadystatechange = function(){
        if(xhr.readyState == 4){
            if (debugMode == true) { console.log("Response on "+url+" :", xhr.responseText); }
            callback(xhr)
        }
    }
}

var TidalResolver = Tomahawk.extend( TomahawkResolver, {

    /* This can also be used with WIMP service if you change next 2 lines */
    api_location : 'https://listen.tidalhifi.com/v1/',
    api_token : 'P5Xbeo5LFvESeDy6',

    settings: {
        cacheTime: 300,
        name: 'TIDAL',
        icon: '../images/icon.png',
        weight: 91,
        timeout: 8
    },

    strQuality : ['LOW', 'HIGH', 'LOSSLESS'],

    getConfigUi: function() {
        return {
            "widget": Tomahawk.readBase64( "config.ui" ),
            fields: [{
                name: "email",
                widget: "email_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            },{
                name: "quality",
                widget: "quality",
                property: "currentIndex"
            }]
        };
    },

    newConfigSaved: function() {
        var config = this.getUserConfig();
        if (this._email !== config.email || this._password !== config.password|| this._quality != config.quality) {
            this.init();
        }
    },

    init: function() {
        var name = this.settings.name;
        var config = this.getUserConfig();
        this._email = config.email;
        this._password = config.password;
        this._quality = config.quality;

        if (!this._email || !this._password) {
            Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);
            Tomahawk.log( name + " resolver not configured." );
            return;
        }

        Tomahawk.addCustomUrlHandler( 'tidal', 'getStreamUrl', true );

        var that = this;
        this._login( function() {
        });
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist.name,
            album:      entry.album.title,
            track:      entry.title,
            year:       entry.year,

            albumpos:   entry.trackNumber,
            discnumber: entry.volumeNumber,

            //size:       entry.estimatedSize,
            duration:   entry.duration,

            source:     "",
            url:        'tidal://track/' + entry.id,
            checked:    true,
            bitrate:    1411
        };
    },

    _convertAlbum: function (entry) {
        return {
            artist:     entry.artist.name,
            album:      entry.title
        };
    },

    _convertArtist: function (entry) {
        return entry.name;
    },

    search: function (qid, query) {
        if (!this._countryCode) return;
        var that = this;

        query = encodeURIComponent(query);

        xhrRequest(that.api_location + "search/tracks","GET", "limit=10000&query=" 
                +query+"&token="+that.api_token+"&countryCode="+that._countryCode,
            function (request) {
                var resp = JSON.parse(request.responseText);
                var data = {
                    qid: qid,
                    results: resp.items.map(that._convertTrack),
                }
                Tomahawk.addTrackResults(data);
            }
        );
        xhrRequest(that.api_location + "search/albums","GET", "limit=10000&query=" 
                +query+"&token="+that.api_token+"&countryCode="+that._countryCode,
            function (request) {
                var resp = JSON.parse(request.responseText);
                var data = {
                    qid: qid,
                    albums: resp.items.map(that._convertAlbum),
                }
                Tomahawk.addAlbumResults(data);
            }
        );
        xhrRequest(that.api_location + "search/artists","GET", "limit=10000&query=" 
                +query+"&token="+that.api_token+"&countryCode="+that._countryCode,
            function (request) {
                Tomahawk.log(request.responseText);
                var resp = JSON.parse(request.responseText);
                var data = {
                    qid: qid,
                    artists: resp.items.map(that._convertArtist),
                }
                Tomahawk.addArtistResults(data);
            }
        );
    },

    resolve: function (qid, artist, album, title) {
        var that = this;
        if (!this._countryCode) return;
        artist = encodeURIComponent(artist);
        album = encodeURIComponent(album);
        title = encodeURIComponent(title);

        xhrRequest(that.api_location + "search/tracks","GET", "query=" 
                +artist+"+"+album+"+"+title+"&token="+that.api_token+"&countryCode="+that._countryCode,
            function (request) {
                var resp = JSON.parse(request.responseText);
                var data = {
                    qid: qid,
                    results: [],
                }
                if (resp.items.length != 0)
                {
                    data.results.push(that._convertTrack(resp.items[0]));
                }
                Tomahawk.addTrackResults(data);
            }
        );
    },

    _parseUrn: function (urn) {
        var match = urn.match( /^tidal:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type:   match[ 1 ],
            id:     match[ 2 ]
        };
    },

    getStreamUrl: function (qid, urn) {
        var that = this;
        if (!this._sessionId) {
            Tomahawk.log("Failed to get stream for '" + urn + "', resolver wasn't logged in yet");
            return;
        }
        urn = this._parseUrn( urn );
        if (!urn || 'track' != urn.type) {
            Tomahawk.log( "Failed to get stream. Couldn't parse '" + urn + "'" );
            return;
        }
        Tomahawk.log("Getting stream for '" + urn + "', track ID is '" + urn.id + "'");

        xhrRequest(that.api_location + "tracks/"+urn.id+"/streamUrl","GET",
                "soundQuality="+that.strQuality[that._quality]
                +"&token="+that.api_token+"&countryCode="+that._countryCode+"&sessionId="+that._sessionId,
            function (request) {
                Tomahawk.log(request.responseText);
                var resp = JSON.parse(request.responseText);
                Tomahawk.reportStreamUrl(qid,resp.url);
            }
        );
    },

    _login: function (callback) {
        this._token = null;

        if (!this._loginCallbacks) {
            this._loginCallbacks = [];
        }
        if (callback) {
            this._loginCallbacks.push(callback);
        }
        // if a login is already in progress just queue the callback
        if (this._loginLock) {
            return;
        }

        this._loginLock = true;

        var that = this;
        var name = this.settings.name;
        xhrRequest(that.api_location + "login/username?token="+that.api_token, "POST",
                "username="+that._email.trim() + "&password=" + that._password.trim(),
            function (request) {
                Tomahawk.log(request.responseText);
                var resp = JSON.parse(request.responseText);
                that._countryCode = resp.countryCode;
                that._sessionId = resp.sessionId;

                Tomahawk.log(name + " logged in successfully");

                for (var idx = 0; idx < that._loginCallbacks.length; idx++) {
                    that._loginCallbacks[ idx ].call(window);
                }
                that._loginCallbacks = null;
                that._loginLock = false;
            }
        );
    }
});

Tomahawk.resolver.instance = TidalResolver;
