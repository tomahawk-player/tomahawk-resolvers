/* Tidal resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov, and William Stott
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

var TidalResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    /* This can also be used with WiMP service if you change next 2 lines */
    api_location : 'https://listen.tidalhifi.com/v1/',
    api_token : 'P5Xbeo5LFvESeDy6',

    logged_in: 0, // 0 = pending, 1 = success, 2 = failed

    settings: {
        cacheTime: 300,
        name: 'TIDAL',
        icon: '../images/icon.png',
        weight: 91,
        timeout: 8
    },

    strQuality: ['LOW', 'HIGH', 'LOSSLESS'],
    numQuality: [ 128,   320,    1411     ],

    getConfigUi: function() {
        // Tomahawk.log('Called getConfigUi()');
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
        if (this._email !== config.email || this._password !== config.password || this._quality != config.quality) {
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

        this._login();
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist.name,
            album:      entry.album.title,
            track:      entry.title,
            year:       entry.year,

            albumpos:   entry.trackNumber,
            discnumber: entry.volumeNumber,

            duration:   entry.duration,

            url:        'tidal://track/' + entry.id,
            checked:    true,
            bitrate:    this.numQuality[this._quality]
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

    search: function (query) {
        if (!this.logged_in) {
            this._login(this.search, [query], this);
            return;
        }

        var that = this;
        var query = encodeURIComponent(query);
        var params = {
            limit: 25,
            query: query,
            token: this.api_token,
            countryCode: this._countryCode
        };

        tracks = Tomahawk.get(this.api_location + "search/tracks", {
                data: params
            }).then( function (response) {
                return response.items.map(that._convertTrack, that);
        });

        return tracks;

        /*
        albums = Tomahawk.get(this.api_location + "search/albums", {
                data: params
            }).then( function (response) {
                var result =  response.items.map(that._convertAlbum, that);
                return result;
        });

        artists = Tomahawk.get(this.api_location + "search/artists", {
                data: params
            }).then( function (response) {
                return response.items.map(that._convertArtist, that);
        });

        // WIP, many problems with this. Promise.all doesn't seem to work.
        // And tomahawk doesn't support it anyway... yet.
        return Promise.all( [tracks, albums, artists] ).then( function (results) {

            Tomahawk.log('======================= tracks ========================');
            for (var i = 0; i < results[0].length; i++) {
                Tomahawk.log(results[0][i].track);
            }

            Tomahawk.log('======================= albums ========================');
            for (var i = 0; i < results[1].length; i++) {
                Tomahawk.log(results[1][i].album);
            }

            Tomahawk.log('======================= artists ========================');
            for (var i = 0; i < results[2].length; i++) {
                Tomahawk.log(results[2][i]);
            }

            return {
                tracks: results[0],
                albums: results[1],
                artists: results[2]
            };
        });
        */
        
    },

    resolve: function (artist, album, title) {
        if (!this.logged_in) {
            this._login(this.resolve, [artist, album, title], this);
            return;
        } 

        var that = this;

        var query = [ artist, album, title ].join(' ');

        query = query.replace(/[ \-]+/g, ' ');

        return Tomahawk.get(that.api_location + "search/tracks", {
                data: {
                    query: query,
                    token: this.api_token,
                    countryCode: this._countryCode,
                    dataType: 'json'
                }
            }).then(function (response) {
                return response.items.map(that._convertTrack, that);
        });
    },

    _parseUrn: function (urn) {
        // "tidal://track/18692667"
        var match = urn.match( /^tidal:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type: match[ 1 ],
            id:   match[ 2 ]
        };
    },

    getStreamUrl: function (qid, urn) {
        if (!this.logged_in) {
            this._login(this.getStreamUrl, [qid, urn], this);
            return;
        }

        var parsedUrn = this._parseUrn( urn );
        
        if (!parsedUrn || parsedUrn.type != 'track') {
            Tomahawk.log( "Failed to get stream. Couldn't parse '" + urn + "'" );
            return;
        }

        var params = {
            token: this.api_token,
            countryCode: this._countryCode,
            soundQuality: this.strQuality[this._quality],
            sessionId: this._sessionId
        };

        Tomahawk.log("Getting stream for '" + parsedUrn + "', track ID is '" + parsedUrn.id + "'");

        return Tomahawk.get(this.api_location + "tracks/"+parsedUrn.id+"/streamUrl", {
                data: params
            }).then( function (response) {
                Tomahawk.reportStreamUrl(qid, response.url);
                return response.url;
        });
    },

    _login: function (callback, args, scope) {
        if (typeof this._loginCallbacks !== "array") {
            this._loginCallbacks = [];
        }

        if (typeof callback == "function") {
            args = args || [];
            scope = scope || this;
            Tomahawk.log('Deferring action: ', args);
            this._loginCallbacks.push([callback, args, scope]);
        }

        // if a login is already in progress just queue the callback
        if (this._loginLock) return;

        this._token = null;
        this._loginLock = true;
        this.logged_in = 0;

        var that = this;
        var params = "token=" + this.api_token;

        Tomahawk.post(
              // URL
            this.api_location + "login/username?" + params,
            { // Settings
                dataType: 'json',
                type: 'POST', // borked Tomahawk.js
                data: {
                    "username": this._email.trim(),
                    "password": this._password.trim()
                }
            }
        ).then( function (resp) {
            that._countryCode = resp.countryCode;
            that._sessionId = resp.sessionId;

            Tomahawk.log(that.settings.name + " logged in successfully.");

            // Take care of anything Tomahawk asked for before authentication.
            while (that._loginCallbacks.length > 0) {
                var cb = that._loginCallbacks.pop();
                Tomahawk.log('Performing action: ', cb[1]);
                cb[0].call(cb[2], cb[1]);
            }
            that._loginLock = false;
            that.logged_in = 1;
        }, function () {
            Tomahawk.log(that.settings.name + " failed login!");
            // Clear callbacks, let the user refresh once logged in.
            that._loginCallbacks = [];
            that.logged_in = 2;
            that._loginLock = false;
        });
    }
});

Tomahawk.resolver.instance = TidalResolver;