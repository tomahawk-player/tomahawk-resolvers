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

var TidalResolver = Tomahawk.extend( TomahawkResolver, {

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

    strQuality : ['LOW', 'HIGH', 'LOSSLESS'],

    getConfigUi: function() {
        Tomahawk.log('Called getConfigUi()');
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
        Tomahawk.log('Called newConfigSaved()');
        var config = this.getUserConfig();
        if (this._email !== config.email || this._password !== config.password || this._quality != config.quality) {
            this.init();
        }
    },

    init: function() {
        Tomahawk.log('Called init()');
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
        Tomahawk.log('Called _convertTrack()');
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
        Tomahawk.log('Called _convertAlbum()');
        return {
            artist:     entry.artist.name,
            album:      entry.title
        };
    },

    _convertArtist: function (entry) {
        Tomahawk.log('Called _convertArtist()');
        return entry.name;
    },

    search: function (qid, query) {
        Tomahawk.log('Called search()');
        if (!this.logged_in) this._login(this.search, [qid, query], this);

        var that = this;

        var query = encodeURIComponent(query);

        var params = {
            limit: 25,
            query: query ,
            token: this.api_token ,
            countryCode: this._countryCode
        };

        return Tomahawk.ajax(this.api_location + "search/tracks",
            {
                data: params
            }
        ).then( function (response) {
            var data = {
                qid: qid,
                tracks: response.items.map(that._convertTrack),
            }
            Tomahawk.addTrackResults(data);
        });

        // TODO: Return these too!

        Tomahawk.ajax(this.api_location + "search/albums",
            {
                data: params
            }
        ).then( function (response) {
            var data = {
                qid: qid,
                albums: response.items.map(that._convertAlbum),
            }
            Tomahawk.addAlbumResults(data);
        });

        Tomahawk.ajax(this.api_location + "search/artists",
            {
                data: params
            }
        ).then( function (response) {
            var data = {
                qid: qid,
                artists: response.items.map(that._convertArtist),
            }
            Tomahawk.addArtistResults(data);
        });
    },

    resolve: function (qid, artist, album, title) {
        Tomahawk.log('Called resolve()');
        if (!this.logged_in) this._login(this.resolve, [qid, artist, album, title], this);

        var that = this;

        var query = [
            artist.replace('-', ' '),
            album.replace('-', ' '),
            title.replace('-', ' ')
        ].join(' ');

        query = query.replace(/ +/, ' ');

        Tomahawk.log(query);

        return Tomahawk.ajax(that.api_location + "search/tracks", {
            data: {
                query: query,
                token: this.api_token,
                countryCode: this._countryCode
            }
        }).then(function (response) {
            var data = {
                qid: qid,
                results: response.items.map(that._convertTrack),
            }
            Tomahawk.addTrackResults(data);
        });
    },

    _parseUrn: function (urn) {
        Tomahawk.log('Called _parseUrn()');
        var match = urn.match( /^tidal:\/\/([a-z]+)\/(.+)$/ );
        if (!match) return null;

        return {
            type:   match[ 1 ],
            id:     match[ 2 ]
        };
    },

    getStreamUrl: function (qid, urn) {
        Tomahawk.log('Called getStreamUrl()');
        if (!this.logged_in) this._login(this.getStreamUrl, [qid, urn], this);

        var that = this;

        var urn = this._parseUrn( urn );

        var params = {
            token: this.api_token,
            countryCode: this._countryCode,
            soundQuality: that.strQuality[that._quality],
            sessionId: that._sessionId
        };
        
        if (!urn || 'track' != urn.type) {
            Tomahawk.log( "Failed to get stream. Couldn't parse '" + urn + "'" );
            return;
        }

        Tomahawk.log("Getting stream for '" + urn + "', track ID is '" + urn.id + "'");

        Tomahawk.ajax(that.api_location + "tracks/"+urn.id+"/streamUrl",
            {
                data: params
            }
        ).then( function (response) {
            Tomahawk.reportStreamUrl(qid, response.url);
        });
    },

    _login: function (callback, args, scope) {
        Tomahawk.log('Called _login()');

        this._token = null;

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
        if (this._loginLock) {
            return;
        } else {
            this._loginLock = true;
            this.logged_in = 0;
        }

        var that = this;
        var params = "token=" + this.api_token;

        Tomahawk.post(
              // URL
            that.api_location + "login/username?" + params,
            { // Settings
                dataType: 'json',
                type: 'POST', // borked Tomahawk.js
                data: {
                    "username": that._email.trim(),
                    "password": that._password.trim()
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