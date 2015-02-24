/* Tidal resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov, and Will Stott
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

    logged_in: null, // null, = not yet tried, 0 = pending, 1 = success, 2 = failed

    settings: {
        cacheTime: 300,
        name: 'TIDAL',
        icon: '../images/icon.png',
        weight: 91,
        timeout: 8
    },

    strQuality: ['LOW', 'HIGH', 'LOSSLESS'],
    numQuality: [ 64,    320,    1411     ],

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

        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        Tomahawk.addCustomUrlHandler( 'tidal', 'getStreamUrl', true );

        return this._login();
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
            album:      entry.title,
            url:        entry.url
        };
    },

    _convertArtist: function (entry) {
        return {
            name: entry.name,
        };
    },

    _convertPlaylist: function (entry) {
        return {
            title:      entry.title,
            guid:       "tidal-playlist-" + entry.uuid,
            info:       entry.description + " (from TidalHiFi)",
            creator:    "tidal-user-" + entry.creator.id,
            // TODO: Perhaps use tidal://playlist/uuid
            url:        entry.url
        };
    },

    search: function (query, limit) {
        if (!this.logged_in) {
            return this._defer(this.search, [query], this);
        } else if (this.logged_in ===2) {
            return null;
        }

        var that = this;

        var params = {
            limit: limit || 9999,
            query: query.replace(/[ \-]+/g, ' ').toLowerCase(),

            sessionId: this._sessionId,
            countryCode: this._countryCode
        };

        return Tomahawk.get(this.api_location + "search/tracks", {
            data: params
        }).then( function (response) {
            return response.items.map(that._convertTrack, that);
        });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, album, title ].join(' ');

        return this.search(query, 5);
    },

    _parseUrlPrefix: function (url) {
        var match = url.match( /https?:\/\/(?:listen|play|www)+.(tidalhifi|wimpmusic).com\/(?:v1\/)?([a-z]{3,}?)s?\/([\w\-]+)[\/?]?/ );
        // http://www.regexr.com/3afug
        // 1: 'tidalhifi' or 'wimpmusic'
        // 2: 'artist' or 'album' or 'track' or 'playlist' (removes the s)
        // 3: ID of resource (seems to be the same for both services!)
        return match;
    },

    canParseUrl: function (url, type) {
        url = this._parseUrlPrefix(url);
        if (!url) return false;

        switch (type) {
            case TomahawkUrlType.Album:
                return url[2] == 'album';
            case TomahawkUrlType.Artist:
                return url[2] == 'artist';
            case TomahawkUrlType.Track:
                return url[2] == 'track';
            case TomahawkUrlType.Playlist:
                return url[2] == 'playlist';
            default:
                return true;
        }
    },

    _debugPrint: function (obj, spaces) {
        spaces = spaces || '';

        var str = '';
        for (key in obj) {
            if (typeof obj[key] === "object") {
                var b = ["{", "}"]
                if (obj[key].constructor == Array) {
                    b = ["[", "]"];
                }
                str += spaces+key+": "+b[0]+"\n"+this._debugPrint(obj[key], spaces+'    ')+"\n"+spaces+b[1]+'\n';
            } else {
                str += spaces+key+": "+obj[key]+"\n";
            }
        }
        if (spaces != '') {
            return str;
        } else {
            str.split('\n').map(Tomahawk.log, Tomahawk);
        }
    },

    lookupUrl: function (url) {
        if (!this.logged_in) {
            return this._defer(this.lookupUrl, [url], this);
        } else if (this.logged_in === 2) {
            Tomahawk.addUrlResult(url, null);
            return null;
        }

        var match = this._parseUrlPrefix(url);

        Tomahawk.log(url + " -> " + match[1] + " " + match[2] + " " + match[3]);

        if (!match[1]) return false;

        var that = this;
        var cb = undefined;
        var promise = null;
        var suffix = '/';
        var params = {
            countryCode: this._countryCode,
            sessionId: this._sessionId
        };

        if (match[2] == 'album') {
            var rqUrl = this.api_location + 'albums/' + match[3];

            var getInfo = Tomahawk.get(rqUrl, { data: params } );
            var getTracks = Tomahawk.get(rqUrl + "/tracks", { data: params });

            Tomahawk.log(rqUrl);

            promise = Promise.all([getInfo, getTracks]).then( function (response) {
                var result = that._convertAlbum(response[0]);
                result.tracks = response[1].items.map(that._convertTrack, that);
                result.tracks.map(function (item) {item.type="track"});
                return result;
            });

        } else if (match[2] == 'artist') {
            var rqUrl = this.api_location + 'artists/' + match[3];

            promise = Tomahawk.get(rqUrl, {
                data: params
            }).then(function (response) {
                return that._convertArtist(response);
            });

        } else if (match[2] == 'track') {
            var rqUrl = this.api_location + 'tracks/' + match[3];
            // I can't find any link on the site for tracks.
            promise = Tomahawk.get(rqUrl, {
                data: params
            }).then(function (response) {
                return that._convertTrack(response);
            });

        } else if (match[2] == 'playlist') {
            var rqUrl = this.api_location + 'playlists/' + match[3];

            var getInfo = Tomahawk.get(rqUrl, { data: params } );
            var getTracks = Tomahawk.get(rqUrl + "/tracks", { data: params });

            promise = Promise.all([getInfo, getTracks]).then( function (response) {
                var result = that._convertPlaylist(response[0]);
                result.tracks = response[1].items.map(that._convertTrack, that);
                result.tracks.map(function (item) {item.type="track"});
                return result;
            });
        }

        /*return */promise.then(function (result) {
            result.type = match[2];
            that._debugPrint(result);
            Tomahawk.addUrlResult(url, result);
        }).catch(function (e) {
            Tomahawk.log("Error in lookupUrl! " + e);
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

    getStreamUrl: function(qid, url) {
        Promise.resolve(this._getStreamUrlPromise(url)).then(function(streamUrl){
            Tomahawk.reportStreamUrl(qid, streamUrl);
        });
    },

    _getStreamUrlPromise: function (urn) {
        if (!this.logged_in) {
            return this._defer(this.getStreamUrl, [urn], this);
        } else if (this.logged_in === 2) {
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

        return Tomahawk.get(this.api_location + "tracks/"+parsedUrn.id+"/streamUrl", {
                data: params
            }).then( function (response) {
                return response.url;
        });
    },

    _defer: function (callback, args, scope) {
        if ('then' in this._loginPromise) {
            args = args || [];
            scope = scope || this;
            Tomahawk.log('Deferring action with ' + args.length + ' arguments.');
            return this._loginPromise.then(function () {
                Tomahawk.log('Callback.');
                callback.call(scope, args);
            });
        }
    },

    _login: function () {
        // If a login is already in progress don't start another!
        if (this._loginLock) return;

        this._loginLock = true;
        this.logged_in = 0;

        var that = this;
        var params = "?token=" + this.api_token;

        this._loginPromise = Tomahawk.post( this.api_location + "login/username" + params, {
                type: 'POST', // borked Tomahawk.js
                data: {
                    "username": this._email.trim(),
                    "password": this._password.trim()
                }
            }
        ).then( function (resp) {
            Tomahawk.log(that.settings.name + " logged in successfully.");

            that._countryCode = resp.countryCode;
            that._sessionId = resp.sessionId;
            that._userId = resp.userId;
            that._loginLock = false;
            that.logged_in = 1;
        }, function (error) {
            Tomahawk.log(that.settings.name + " failed login.");

            delete that._countryCode;
            delete that._sessionId;
            delete that._userId;
            that._loginLock = false;
            that.logged_in = 2;
        });

        return this._loginPromise;
    }
});

Tomahawk.resolver.instance = TidalResolver;