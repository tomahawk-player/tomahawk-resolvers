/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011, Dominik Schmidt <domme@tomahawk-player.org>
 *   Copyright 2011, Leo Franchi <lfranchi@kde.org>
 *   Copyright 2013, Teo Mrnjavac <teo@kde.org>
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

var AmpacheResolver = Tomahawk.extend(Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,
    ready: false,
    artists: {},
    albums: {},
    settings: {
        name: 'Ampache',
        icon: 'ampache-icon.png',
        weight: 85,
        timeout: 5,
        limit: 10
    },

    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {

            "widget": uiData,
            fields: [{
                name: "server",
                widget: "serverLineEdit",
                property: "text"
            }, {
                name: "username",
                widget: "usernameLineEdit",
                property: "text"
            }, {
                name: "password",
                widget: "passwordLineEdit",
                property: "text"
            }],
            images: [{
                "owncloud.png": Tomahawk.readBase64("owncloud.png")
            }, {
                "ampache.png": Tomahawk.readBase64("ampache.png")
            }]
        };
    },

    newConfigSaved: function () {
        var userConfig = this.getUserConfig();
        if ((userConfig.username != this.username) || (userConfig.password != this.password)
            || (userConfig.server != this.server)) {
            Tomahawk.readdResolver();
            Tomahawk.PluginManager.unregisterPlugin("collection", this);
            this.init();
        }
    },

    init: function () {
        this.ready = false;

        if (!this.element) {
            this.element = document.createElement('div');
        }

        // check resolver is properly configured
        var userConfig = this.getUserConfig();
        if (!userConfig.username || !userConfig.password || !userConfig.server) {
            Tomahawk.log("Ampache Resolver not properly configured!");
            return;
        }

        this.sanitizeConfig(userConfig);
        this.username = userConfig.username;
        this.password = userConfig.password;
        this.server = userConfig.server;

        return this.login(this);
    },

    // WIP:
/*    configTest: function () {
        var that = this;
        this.prepareHandshake();
        Tomahawk.asyncRequest(this.generateUrl('handshake', this.passphrase, this.params),
            function (xhr) {
                // parse the result
                var domParser = new DOMParser();
                xmlDoc = domParser.parseFromString(xhr.responseText, "text/xml");
                that.applyHandshake(xmlDoc);

                if (!that.auth) {
                    Tomahawk.log("auth failed: " + xhr.responseText);
                    var error = xmlDoc.getElementsByTagName("error")[0];
                    if (typeof error != 'undefined' && error.getAttribute("code") == "403") {
                        Tomahawk.onConfigTestResult(TomahawkConfigTestResultType.InvalidAccount);
                    } else {
                        Tomahawk.onConfigTestResult(TomahawkConfigTestResultType.InvalidCredentials);
                    }
                } else {
                    Tomahawk.onConfigTestResult(TomahawkConfigTestResultType.Success);
                }
            }, {}, {
                errorHandler: function () {
                    Tomahawk.onConfigTestResult(TomahawkConfigTestResultType.CommunicationError);
                }
            });
    },*/
    testConfig: function (config) {
        return this.handshake(this.sanitizeConfig(config));
    },

    sanitizeConfig: function(config) {
        if (!config.server) {
            config.server = "http://localhost/ampache";
        } else {
            if (config.server.search(".*:\/\/") < 0) {
                // couldn't find a proper protocol, so we default to "http://"
                config.server = "http://" + config.server;
            }
            config.server = config.server.trim();
        }

        return config;
    },

    handshake: function(config) {
        var time = Tomahawk.timestamp();
        var passphrase;
        if (typeof CryptoJS !== "undefined" && typeof CryptoJS.SHA256 == "function") {
            var key = CryptoJS.SHA256(config.password).toString(CryptoJS.enc.Hex);
            passphrase = CryptoJS.SHA256(time + key).toString(CryptoJS.enc.Hex);
        } else {
            var key = Tomahawk.sha256(config.password);
            passphrase = Tomahawk.sha256(time + key);
        }

        var params = {};
        params.user = config.username;
        params.timestamp = time;
        params.version = 350001;
        params.auth = passphrase;

        var resolver = this;
        return this.apiCallBase(config.server, 'handshake', params).then(this.parseHandshakeResult);
    },

    parseHandshakeResult: function(xmlDoc)
    {
        var roots = xmlDoc.getElementsByTagName("root");;
        var auth = roots[0] === undefined ? false : Tomahawk.valueForSubNode(roots[0], "auth");
        if (!auth) {
            Tomahawk.log("INVALID HANDSHAKE RESPONSE: ", xmlDoc);
            throw new Error("Handshake failed");
        }

        Tomahawk.log("New auth token: " + auth);
        var pingInterval = parseInt(roots[0] === undefined ? 0 : Tomahawk.valueForSubNode(roots[0], "session_length")) * 1000;
        var trackCount = roots[0] === undefined ? (-1) : Tomahawk.valueForSubNode(roots[0], "songs");

        return {
            auth: auth,
            trackCount: trackCount > -1 ? parseInt(trackCount) : trackCount,
            pingInterval: pingInterval
        };
    },

    login: function (config) {
        var resolver = this;
        return this.handshake(config).then(function(result) {
            resolver.auth = result.auth;
            resolver.trackCount = result.trackCount;

            Tomahawk.log("Ampache Resolver properly initialised!", result);
            resolver.ready = true;
            Tomahawk.readdResolver();
            Tomahawk.PluginManager.registerPlugin("collection", resolver);

            // FIXME: the old timer should be cancelled ...
            if (result.pingInterval) window.setInterval(resolver.ping, result.pingInterval - 60);
        });
    },

    ampacheUrl: function (serverUrl) {
        return serverUrl.replace(/\/$/, "") + "/server/xml.server.php";
    },

    apiCallBase: function(serverUrl, action, params) {
        params = params || {};
        params.action = action;

        var options = {
            url: this.ampacheUrl(serverUrl),
            data: params
        };

        return Tomahawk.get(options);
    },

    apiCall: function(action, params) {
        if (!this.auth) {
            throw new Error("Not authed, can't do api call");
        }

        params = params || {};
        params.auth = this.auth;

        var resolver = this;
        return this.apiCallBase(this.server, action, params).then(function (xmlDoc) {
            var error = xmlDoc.getElementsByTagName("error")[0];
            if ( typeof error != 'undefined' && error.getAttribute("code") == "401" ) //session expired
            {
                Tomahawk.log("Let's reauth for: " + action);
                return resolver.login().then(function () {
                    return resolver.apiCallBase(action, params);
                }, function (error) {
                    throw new Error("Could not renew session.");
                    Tomahawk.readdResolver();
                    Tomahawk.PluginManager.unregisterPlugin("collection", resolver);
                });
            }

            return xmlDoc;
        });
    },

    ping: function () {
        this.apiCall('ping').then(function() {
            Tomahawk.log('Ping succeeded.');
        }, function() {
            Tomahawk.log('Ping failed.');
        });
    },

    decodeEntity : function(str)
    {
        this.element.innerHTML = str;
        return this.element.textContent;
    },

    parseSongResponse: function(xmlDoc) {
        var results = new Array();
        // check the repsonse
        var songElements = xmlDoc.getElementsByTagName("song")[0];
        if (songElements !== undefined && songElements.childNodes.length > 0) {
            var songs = xmlDoc.getElementsByTagName("song");

            // walk through the results and store it in 'results'
            for (var i = 0; i < songs.length; i++) {
                var song = songs[i];

                var result = {
                    artist: this.decodeEntity(Tomahawk.valueForSubNode(song, "artist")),
                    album: this.decodeEntity(Tomahawk.valueForSubNode(song, "album")),
                    track: this.decodeEntity(Tomahawk.valueForSubNode(song, "title")),
                    albumpos: Tomahawk.valueForSubNode(song, "track"),
                    //result.year = 0;//valueForSubNode(song, "year");
                    source: this.settings.name,
                    url: Tomahawk.valueForSubNode(song, "url"),
                    //mimetype: valueForSubNode(song, "mime"), //FIXME what's up here? it was there before :\
                    //result.bitrate = valueForSubNode(song, "title");
                    size: Tomahawk.valueForSubNode(song, "size"),
                    duration: Tomahawk.valueForSubNode(song, "time"),
                    score: Tomahawk.valueForSubNode(song, "rating")
                };

                results.push(result);
            }
        }
        return results;
    },

    resolve: function (artist, album, title) {
        return this.search(title);
    },

    search: function (searchString) {
        if (!this.ready) return;

        var params = {
            filter: searchString,
            limit: this.settings.limit
        };

        var that = this;
        return this.apiCall("search_songs", params).then(function (xmlDoc) {
            return that.parseSongResponse(xmlDoc);
        });
    },

    // ScriptCollection support starts here
    artists: function () {
        var that = this;
        this.artistIds = {};
        return this.apiCall("artists").then(function (xmlDoc) {
            var results = [];
            // check the repsonse
            var root = xmlDoc.getElementsByTagName("root")[0];
            if (root !== undefined && root.childNodes.length > 0) {
                var artists = xmlDoc.getElementsByTagName("artist");
                for (var i = 0; i < artists.length; i++) {
                    artistName = Tomahawk.valueForSubNode(artists[i], "name");
                    artistId = artists[i].getAttribute("id");
                    results.push(that.decodeEntity(artistName));
                    that.artistIds[artistName] = artistId;
                }
            }

            return { artists: results };
        });
    },

    artistAlbums: function (params) {
        var artist = params.artist;
        var artistId = this.artistIds[artist];
        this.albumIdsForArtist = {};
        var that = this;

        var params = {
            filter: artistId
        };

        return this.apiCall("artist_albums", params).then(function (xmlDoc) {
            var results = [];

            // check the repsonse
            var root = xmlDoc.getElementsByTagName("root")[0];
            if (root !== undefined && root.childNodes.length > 0) {
                var albums = xmlDoc.getElementsByTagName("album");
                for (var i = 0; i < albums.length; i++) {
                    albumName = Tomahawk.valueForSubNode(albums[i], "name");
                    albumId = albums[i].getAttribute("id");

                    results.push(that.decodeEntity(albumName));

                    artistObject = that.albumIdsForArtist[artist];
                    if (artistObject === undefined) artistObject = {};
                    artistObject[albumName] = albumId;
                    that.albumIdsForArtist[artist] = artistObject;
                }
            }

            var return_albums = {
                albums: results
            };
            Tomahawk.log("Ampache albums about to return: " + JSON.stringify( return_albums ));
            return return_albums;
        });
    },

    albumTracks: function (params) {
        var artist = params.artist;
        var album = params.album;

        var artistObject = this.albumIdsForArtist[artist];
        var albumId = artistObject[album];
        var that = this;

        Tomahawk.log("AlbumId for " + artist + " - " + album + ": " + albumId);

        var params = {
            filter: albumId
        };

        return this.apiCall("album_songs", params).then(function (xmlDoc) {
            var tracks_result = that.parseSongResponse(xmlDoc);
            tracks_result.sort( function(a,b) {
                if ( a.albumpos < b.albumpos )
                    return -1;
                else if ( a.albumpos > b.albumpos )
                    return 1;
                else
                    return 0;
            } );

            var return_tracks = {
                results: tracks_result
            };
            Tomahawk.log("Ampache tracks about to return: " + JSON.stringify( return_tracks ));
            return return_tracks;
        });
    },

    collection: function()
    {
        //strip http:// and trailing slash
        var desc = this.server.replace(/^http:\/\//,"")
                               .replace(/^https:\/\//,"")
                               .replace(/\/$/, "")
                               .replace(/\/remote.php\/ampache/, "");

        var return_object = {
            prettyname: "Ampache",
            description: desc,
            iconfile: "ampache-icon.png"
        };

        if ( typeof( this.trackCount ) !== 'undefined' )
            return_object["trackcount"] = this.trackCount;

        //stupid check if it's an ownCloud instance
        if (this.server.indexOf("/remote.php/ampache") !== -1)
        {
            return_object["prettyname"] = "ownCloud";
            return_object["iconfile"] = "owncloud-icon.png";
        }

        return return_object;
    }
});

Tomahawk.resolver.instance = AmpacheResolver;




/*
 * TEST ENVIRONMENT
 */

/*TomahawkResolver.getUserConfig = function() {
    return {
        username: "domme",
        password: "foo",
        ampache: "http://owncloud.lo/ampache"
        //ampache: "http://owncloud.lo/apps/media"
    };
};*/
//
var resolver = Tomahawk.resolver.instance;
//
//
// // configure tests
// var search = {
//     filter: "I Fell"
// };
//
// var resolve = {
//     artist: "The Aquabats!",
//     title: "I Fell Asleep On My Arm"
// };
// // end configure
//
//
//
//
//tests
//resolver.init();
//
// // test search
// //Tomahawk.log("Search for: " + search.filter );
// var response1 = resolver.search( 1234, search.filter );
// //Tomahawk.dumpResult( response1 );
//
// // test resolve
// //Tomahawk.log("Resolve: " + resolve.artist + " - " + resolve.album + " - " + resolve.title );
// var response2 = resolver.resolve( 1235, resolve.artist, resolve.album, resolve.title );
// //Tomahawk.dumpResult( response2 );
// Tomahawk.log("test");
// n = 0;
// var items = resolver.getArtists( n ).results;
// for(var i=0;i<items.length;i++)
// {
//     artist = items[i];
//     Tomahawk.log("Artist: " + artist);
//     var albums = resolver.getAlbums( ++n, artist ).results;
//     for(var j=0;j<albums.length;j++)
//     {
//         var album = albums[j];
//         Tomahawk.dumpResult( resolver.getTracks( ++n, artist, album ) );
//     }
// }
//
// phantom.exit();
