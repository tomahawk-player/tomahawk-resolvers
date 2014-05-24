/* Google Play Music resolver for Tomahawk.
 * 
 * Written in 2013 by Sam Hanes <sam@maltera.com>
 * Extensive modifications in 2014 by Lalit Maganti
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

var GMusicResolver = Tomahawk.extend( TomahawkResolver, {
    settings: {
        name: 'Google Play Music',
        icon: '../images/icon.png',
        weight: 90,
        timeout: 8
    },

    _version:   '0.1',
    _baseURL:   'https://www.googleapis.com/sj/v1/',
    _webURL:    'https://play.google.com/music/',

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
            }],
            images: [{
                "play-logo.png":
                    Tomahawk.readBase64( "play-logo.png" )
            }]
        };
    },

    newConfigSaved: function() {
        var config = this.getUserConfig();
        if (this._email !== config.email
                || this._password !== config.password)
            this.init();
    },

    init: function() {
        var name = this.settings.name;
        var config = this.getUserConfig();
        this._email = config.email;
        this._password = config.password;

        if (!this._email || !this._password) {
            Tomahawk.log( name + " resolver not configured." );
            return;
        }

        // check that we have all the needed CryptoJS modules
        {   var error = false;
            if (error |= 'object' !== typeof CryptoJS) {
                Tomahawk.log( "CryptoJS missing" );
            } else {
                if (error |= 'object' !== typeof CryptoJS.algo.HMAC)
                    Tomahawk.log( "CryptoJS.algo.HMAC missing" );

                if (error |= 'object' !== typeof CryptoJS.algo.SHA1)
                    Tomahawk.log( "CryptoJS.algo.SHA1 missing" );

                if (error |= 'object' !== typeof CryptoJS.enc.Base64)
                    Tomahawk.log( "CryptoJS.enc.Base64 missing" );
            }

            if (error) {
                Tomahawk.log( "Required CryptoJS modules are missing."
                        + " Did cryptojs.js get loaded? Some versions"
                        + " of Tomahawk don't load extra scripts when"
                        + " installing unpacked resolvers. Try making"
                        + " an AXE and installing it instead."
                    );
                return;
            }
        }

        // load signing key
        {   var s1 = CryptoJS.enc.Base64.parse(
                    'VzeC4H4h+T2f0VI180nVX8x+Mb5HiTtGnKgH52Otj8ZCGDz9jRW'
                    + 'yHb6QXK0JskSiOgzQfwTY5xgLLSdUSreaLVMsVVWfxfa8Rw=='
                );
            var s2 = CryptoJS.enc.Base64.parse(
                    'ZAPnhUkYwQ6y5DdQxWThbvhJHN8msQ1rqJw0ggKdufQjelrKuiG'
                    + 'GJI30aswkgCWTDyHkTGK9ynlqTkJ5L4CiGGUabGeo8M6JTQ=='
                );

            for (var idx = 0; idx < s1.words.length; idx++)
                s1.words[ idx ] ^= s2.words[ idx ];
            this._key = s1;
        }

        Tomahawk.addCustomUrlHandler( 'gmusic', 'getStreamUrl', true );

        var that = this;
        this._login( function() {
            that._loadWebToken( function() {
                that._loadSettings( function() {
                    that._ready = true;
                });
            });
        });
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist,
            duration:   entry.durationMillis / 1000,
            source:     "Google Music",
            track:      entry.title,
            url:        'gmusic://track/' + entry.id,
        };
    },

    _convertAlbum: function (entry) {
        return {
            artist:     entry.artist,
            album:      entry.album,
            year:       entry.year
        };
    },

    _convertArtist: function (entry) {
        return entry.artist;
    },

    _execSearch: function (query, callback, max_results) {
        var url =  this._baseURL + 'trackfeed';

        var that = this;
        this._request( 'POST', url, function (request) {
            if (200 != request.status) {
                Tomahawk.log(
                        "Google Music search '" + query + "' failed:\n"
                        + request.status + " "
                        + request.statusText.trim() + "\n"
                        + request.responseText.trim()
                    );
                return;
            }

            var response = JSON.parse( request.responseText );
            var results = { tracks: [], albums: [], artists: [] };
            for (var idx = 0; idx < response.data.items.length; idx++) {
                var entry = response.data.items[ idx ];
                var lowerQuery = query.toLowerCase();
                if (entry.artist.toLowerCase() === lowerQuery 
                    || entry.album.toLowerCase() === lowerQuery
                    || entry.title.toLowerCase() === lowerQuery) {
                    var artist = that._convertArtist(entry);
                    var album = that._convertAlbum(entry);
                    if (!that.containsObject(artist, results.artists)) {
                        results.artists.push(artist);
                    }
                    if (!that.containsObject(album, results.albums)) {
                        results.albums.push(album);
                    }
                    results.tracks.push(that._convertTrack(entry));
                }
            }
            callback.call( window, results );
        });
    },

    search: function (qid, query) {
        if (!this._ready) return;

        this._execSearch( query, function (results) {
            Tomahawk.addTrackResults(
                    { 'qid': qid, 'results': results.tracks } );
            Tomahawk.addAlbumResults(
                    { 'qid': qid, 'results': results.albums } );
            Tomahawk.addArtistResults(
                    { 'qid': qid, 'results': results.artists } );
        });
    },

    resolve: function (qid, artist, album, title) {
        if (!this._ready) return;
        var query = title;
        this._execSearch( query, function (results) {
            if (results.tracks.length > 0) {
                Tomahawk.addTrackResults({ 'qid': qid, 'results': [ results.tracks[0] ] } );
            } else {
                // no matches, don't wait for the timeout
                Tomahawk.addTrackResults({ 'qid': qid, 'results': [] });
            }
        }, 1 );
    },

    _parseUrn: function (urn) {
        var match = urn.match( /^gmusic:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type:   match[ 1 ],
            id:     match[ 2 ]
        };
    },

    getStreamUrl: function (qid, urn) {
        if (!this._ready) return;
        Tomahawk.log( "getting stream for '" + urn + "'" );

        urn = this._parseUrn( urn );
        if (!urn || 'track' != urn.type)
            return;

        Tomahawk.log( "track ID is '" + urn.id + "'" );

        // TODO - this is required for the All Access part of Google Music
        /*// generate 13-digit numeric salt
        var salt = '' + Math.floor( Math.random() * 10000000000000 );

        // generate SHA1 HMAC of track ID + salt
        // encoded with URL-safe base64
        var sig = CryptoJS.HmacSHA1( urn.id + salt, this._key )
                .toString( CryptoJS.enc.Base64 )
                .replace( /=+$/, '' )   // no padding
                .replace( /\+/g, '-' )  // URL-safe alphabet
                .replace( /\//g, '_' )  // URL-safe alphabet
            ;*/

        var url = 'https://android.clients.google.com/music/mplay'
                + '?net=wifi&pt=e&targetkbps=8310'
                + '&' + ('T' == urn.id[ 0 ] ? 'mjck' : 'songid')
                    + '=' + urn.id;

        Tomahawk.reportStreamUrl(qid, url, {
            'Authorization': 'GoogleLogin auth=' + this._token,
            'X-Device-ID'  : this._deviceId
        });
    },

    _loadSettings: function (callback) {
        var that = this;
        that._request(
            'POST', that._webURL
                    + 'services/loadsettings?u=0&xt='
                    + encodeURIComponent( that._xt ),
            function (request) {
                if (200 != request.status) {
                    Tomahawk.log(
                            "settings request failed:\n"
                            + request.status + " "
                            + request.statusText.trim()
                        );
                    return;
                }

                var response = JSON.parse( request.responseText );
                if (!response.settings) {
                    Tomahawk.log( "settings request failed:\n"
                            + request.responseText.trim()
                        );
                    return;
                }

                that._allAccess = response.settings.isSubscription;
                Tomahawk.log( "Google Play Music All Access is "
                        + (that._allAccess ? "enabled" : "disabled" )
                    );

                var device = null;
                var devices = response.settings.devices;
                for (var i = 0; i < devices.length; i++) {
                    var entry = devices[ i ];
                    if ('PHONE' == entry.type) {
                        device = entry;
                        break;
                    }
                }

                if (device) {
                    that._deviceId = device.id.slice( 2 );
                    Tomahawk.log(that._deviceId);

                    Tomahawk.log( that.settings.name 
                            + " using device ID from "
                            + device.carrier + " "
                            + device.manufacturer + " "
                            + device.model
                        );

                    callback.call( window );
                } else {
                    Tomahawk.log( that.settings.name
                            + ": there aren't any Android devices"
                            + " associated with your Google account."
                            + " This resolver needs an Android device"
                            + " ID to function. Please open the Google"
                            + " Music application on an Android device"
                            + " and log in to your account."
                        );
                }
            },
            { 'Content-Type': 'application/json' }, 
            JSON.stringify({ 'sessionId': '' })
        );
    },

    _loadWebToken: function (callback) {
        var that = this;
        that._request( 'HEAD', that._webURL + 'listen',
            function (request) {
                if (200 != request.status) {
                    Tomahawk.log( "request for xt cookie failed:"
                            + request.status + " "
                            + request.statusText.trim()
                        );
                    return;
                }

                var match = request.getResponseHeader( 'Set-Cookie' )
                                .match( /^xt=([^;]+)(?:;|$)/m );
                if (match) {
                    that._xt = match[ 1 ];
                    callback.call( window );
                } else {
                    Tomahawk.log( "xt cookie missing" );
                    return;
                }
            }
        );
    },


    /** Called when the login process is completed.
     * @callback loginCB
     */

    /** Asynchronously authenticates with the SkyJam service.
     * Only one login attempt will run at a time. If a login request is
     * already pending the callback (if one is provided) will be queued
     * to run when it is complete. 
     * 
     * @param {loginCB} [callback] a function to be called on completion
     */
    _login: function (callback) {
        this._token = null;

        // if a login is already in progress just queue the callback
        if (this._loginLock) {
            this._loginCallbacks.push( callback );
            return;
        }

        this._loginLock = true;
        this._loginCallbacks = [ callback ];

        var that = this;
        var name = this.settings.name;
        this._request(
            'POST', 'https://www.google.com/accounts/ClientLogin',
            function (request) {
                if (200 == request.status) {
                    that._token = request.responseText
                            .match( /^Auth=(.*)$/m )[ 1 ];
                    that._loginLock = false;
            
                    Tomahawk.log( name + " logged in successfully" );

                    for (var idx = 0; idx < that._loginCallbacks.length; idx++) {
                        that._loginCallbacks[ idx ].call( window );
                    }
                    that._loginCallbacks = null;
                } else {
                    Tomahawk.log(
                            name + " login failed:\n"
                            + request.status + " "
                            + request.statusText.trim() + "\n"
                            + request.responseText.trim()
                        );
                }
            }, null,
            {   'accountType':  'HOSTED_OR_GOOGLE',
                'Email':        that._email.trim(),
                'Passwd':       that._password.trim(),
                'service':      'sj',
                'source':       'tomahawk-gmusic-' + that._version
            }, true
        );
    },

    /** Called when an HTTP request is completed.
     * @callback requestCB
     * @param {XMLHttpRequest} request the completed request
     */

    /** Sends an asynchronous HTTP request.
     *
     * If an authentication token is available it will be sent.
     * Unless {@code nologin} is set, if the server returns 401 
     * {@link #_login} will be called and the request will be retried.
     * Automatic login will only be attempted once per request. If 401
     * is returned again after logging in the request will be handled
     * as normal.
     *
     * If {@code body} is not provided the request will be sent without
     * an entity. If a body is provided it must be of a type supported
     * by {@code XMLHttpRequest}. As a special case, if an object is
     * provided it will be interpreted as form parameters and encoded
     * as {@code application/x-www-form-urlencoded}.
     * 
     * @param {string} method the HTTP method to use
     * @param {string} url the URL to request
     * @param {requestCB} callback completion callback function
     * @param {object} [headers] additional request headers
     * @param {string|object} [body] the request entity to be sent
     * @param {boolean} [nologin=false]
     *        whether to suppress automatic re-authentication
     */
     _request: function (method, url, callback, headers, body, nologin) {
        var that = this;
        var args = arguments;

        // if we're waiting for a login, queue the request
        if (!nologin && this._loginLock) {
            this._loginCallbacks.push( function() {
                args[ 5 ] = true; // set nologin
                that._request.apply( that, args );
            } );
            return;
        }

        var request = new XMLHttpRequest();
        request.open( method, url, true );

        // prevent useless parsing of the response
        request.responseType = 'text';

        // add the authentication token if we have one
        if (this._token) request.setRequestHeader(
                'Authorization', 'GoogleLogin auth=' + this._token );

        // add extra request headers
        if (headers) for (var name in headers)
            request.setRequestHeader( name, headers[ name ] );

        // add extra request headers
        for (var name in request.headers)
            Tomahawk.log(name);

        var name = this.settings.name;
        request.onreadystatechange = function() {
            if (4 != request.readyState) return;

            // log in and retry if necessary
            if (401 == request.status && !nologin) {
                Tomahawk.log( name + ' login expired, re-authenticating' );
                that._login( function() {
                    args[ 5 ] = true; // set nologin
                    that._request.apply( that, args );
                });
            } else {
                callback.call( window, request );
            }
        }

        // if body given as object encode as x-www-form-urlencoded
        if ('object' == typeof body) {
            request.setRequestHeader( 'Content-Type',
                    'application/x-www-form-urlencoded' );

            function encode (value) {
                // close enough to x-www-form-urlencoded
                return encodeURIComponent( value ).replace( '%20', '+' );
            }

            var postdata = "";
            for (var name in body) {
                postdata += '&' + encode( name )
                    + '=' + encode( body[ name ] );
            }

            body = postdata.substring( 1 );
        }

        if (body) {
            request.send( body );
        } else {
            request.send();
        }
    },

    containsObject: function (obj, list) {
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] === obj) {
                return true;
            }
        }

        return false;
    }
});

Tomahawk.resolver.instance = GMusicResolver;
