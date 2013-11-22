/*
 * (c) 2013 Ron Jaegers <ron.jaegers@gmail.com>
 *
 * TODO List
 * - Timeout after login, recover.
 * - User feedback in case of wrong credentials.
 * - Use "new style" API for searches and starting stream (based on track id).
 * - Support multiple mime types
 * - Remove limitation of single search keyword (i.e. use new api for searches).
 */

var SynologyResolver = Tomahawk.extend(TomahawkResolver, {
    trackCount: -1,
    settings: {
        name: 'Synology',
        icon: 'audiostation-icon.png',
        weight: 95,
        timeout: 5
    },
    errors: {
        100: "Unknown error",
        101: "Invalid parameters",
        102: "The requested API does not exist",
        103: "The requested method does not exist",
        104: "The requested version does not support this functionality",
        105: "The logged-in session does not have permission",
        106: "Session timeout",
        107: "Session interrupted by duplicate login"
    },
    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [{
                name: "username",
                widget: "username_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }, {
                name: "dsm_url",
                widget: "dsm_url_edit",
                property: "text"
            }, {
                name: "max_songs",
                widget: "max_songs_spinbox",
                property: "value"
            }],
            images: [{
                "audiostation-icon.png" : Tomahawk.readBase64("audiostation-icon.png")
            }]
        };
    },
    newConfigSaved: function () {
        this.init();
    },
    init: function() {
        var userConfig = this.getUserConfig();
        if (!userConfig.username || !userConfig.password || !userConfig.dsm_url) {
            Tomahawk.log("Synology Resolver not properly configured!");
            return;
        }

        if (this.user !== userConfig.username ||
            this.password !== userConfig.password ||
            this.dsm_url !== userConfig.dsm_url)
        {
            this.user = userConfig.username;
            this.password = userConfig.password;
            this.dsm_url = userConfig.dsm_url.replace(/\/+$/, "");
            this.dsm_port = userConfig.dsm_port || 5000
            this.use_tls = false;

            this.api_info = this.retrieveApiInfo();
            this.authenticate();
        }

        this.max_songs = userConfig.max_songs;
    },
    retrieveApiInfo: function() {
        // This is the only time we need to construct a API URI ourselves.
        // SYNO.API.Info has a fixed path that will never change. We use
        // this to find the location of the other services.
        var info_url = this.apiBaseUrl() +
                       "query.cgi" +
                       "?api=SYNO.API.Info&version=1&method=query&query=ALL";

        var result = JSON.parse(Tomahawk.syncRequest(info_url));
        return result.data;
    },
    authenticate: function() {
        var auth_url = this.buildApiUrl("SYNO.API.Auth", 2, "login",
                                        { account: this.user, passwd: this.password, session: this.createSessionId(), format: "sid" }),
            that = this;

        this.doApiRequest(auth_url, function(jsonResponse) {
            if (typeof(jsonResponse.data.sid) === "undefined") {
                Tomahawk.log("No session identifier (sid) received. Future api calls will fail.");
                Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);

                return;
            }

            that.sid = jsonResponse.data.sid;
            that.getTrackCount();
        });
    },
    getTrackCount: function() {
        // Request all tracks but limit the results to one.
        // In this case the response will contain the total tracks count.
        var track_url = this.buildApiUrl("SYNO.AudioStation.Song", 1, "list", { offset: 0, limit: 1 }),
            that = this;

        this.doApiRequest(track_url, function(jsonResponse) {
            that.trackCount = jsonResponse.data.total;
            Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
        });
    },

    // Resolve and search support.
    resolve: function(qid, artist, album, title) {
        var resolve_url = this.apiBaseUrl().replace("/webapi/", "") +
                          "/webman/3rdparty/AudioStation/webUI/audio_browse.cgi" +
                          "?start=0&limit=1000&target=musiclib_root&action=search&category=title&library=shared" +
                          "&server=musiclib_root&keyword=" + encodeURIComponent(title) +
                          "&sort=album&dir=ASC",
            that = this;

        this.doApiRequest(resolve_url, function(jsonResponse) {
            var results = [];

            jsonResponse.items.forEach(function (item) {
                // This sucks, strings need to exactly match!
                if (item.artist === artist) {
                    results.push(that.convertTrack(item));
                }
            });

            Tomahawk.addTrackResults({
                qid: qid,
                results: results
            });
        });
    },
    search: function(qid, searchString) {
        var search_url = this.apiBaseUrl().replace("/webapi/", "") +
                         "/webman/3rdparty/AudioStation/webUI/audio_browse.cgi" +
                         "?action=search&target=musiclib_root&server=musiclib_root&category=all" +
                         "&keyword=" + encodeURIComponent(searchString) +
                         "&start=0&limit=" + this.max_songs,
            that = this;

        this.doApiRequest(search_url, function(jsonResponse) {
            var results = [];

            jsonResponse.items.forEach(function (item) {
               results.push(that.convertTrack(item));
            });

            Tomahawk.addTrackResults({
                qid: qid,
                results: results
            });
        });
    },

    // Collection support.
    collection: function() {
        return {
            prettyname: this.settings.name,
            description: this.dsm_url,
            iconfile: this.settings.icon,
            trackcount: this.trackCount
        };
    },
    artists: function(qid) {
        var artists_url = this.buildApiUrl("SYNO.AudioStation.Artist", 1, "list", { offset: 0, limit: 2000 });

        this.doApiRequest(artists_url, function(jsonResponse) {
            var results = [];

            jsonResponse.data.artists.forEach(function (item) {
                results.push(item.name);
            });

            Tomahawk.addArtistResults({
                qid: qid,
                artists: results
            });
        });
    },
    albums: function(qid, artist) {
        var albums_url = this.buildApiUrl("SYNO.AudioStation.Album", 1, "list", { offset: 0, limit: 2000, artist: artist });

        this.doApiRequest(albums_url, function(jsonResponse) {
            var results = [];

            jsonResponse.data.albums.forEach(function (item) {
                results.push(item.name);
            });

            Tomahawk.addAlbumResults({
                qid: qid,
                artist: artist,
                albums: results
            });
        });
    },
    tracks: function(qid, artist, album) {
        var track_url = this.buildApiUrl("SYNO.AudioStation.Song", 1, "list", { offset: 0, limit: this.max_songs, artist: artist, album: album }),
            that = this;

        this.doApiRequest(track_url, function(jsonResponse) {
            var results = [],
                tracknr = 1;

            jsonResponse.data.songs.forEach(function (item) {
                results.push({
                    artist: artist,
                    album: album,
                    track: item.title,
                    albumpos: tracknr++,
                    // Addition of /volume1 to path will probably not work for every configuration.
                    // When we transition to id based stream url's this workaround should go.
                    url: that.buildStreamUrl("/volume1" + item.path),
                    source: that.settings.name,
                    score: 1.0,
                    mimetype: "audio/mpeg"
                });
            });

            Tomahawk.addAlbumTrackResults({
                qid: qid,
                artist: artist,
                album: album,
                results: results
            });
        });
    },

    // Helper methods.
    apiBaseUrl: function() {
        return (this.use_tls ? "https://" : "http://") + this.dsm_url + ":" + this.dsm_port + "/webapi/";
    },
    buildApiUrl: function(api, version, method, urlParameters) {
        if (typeof(this.api_info[api]) === "undefined") {
            Tomahawk.log("Requested unknown API[" + api + "] request will fail.");
        }

        return this.apiBaseUrl() +
               this.api_info[api].path +
               "?api=" + api +
               "&version=" + version +
               "&method=" + method +
               this.buildUrlParameters(urlParameters) +
               "&sid=" + this.sid;
    },
    buildUrlParameters: function(parameters) {
        var url = "";
        for (var parameter in parameters) {
                url += "&" + parameter + "=" + encodeURIComponent(parameters[parameter]);
        }
        return url;
    },
    buildStreamUrl: function(resourceLocation) {
        return this.apiBaseUrl().replace("/webapi/", "") +
               "/webman/3rdparty/AudioStation/webUI/audio_stream.cgi/0.mp3" +
               "?sid=" + this.sid +
               "&action=streaming" +
               "&songpath=" + encodeURIComponent(resourceLocation).replace("+", "%20").replace("&", "%26");
    },
    createSessionId: function() {
        return "Tomahawk" + Math.floor((Math.random() * 10000) + 1);
    },
    doApiRequest: function(url, onSuccess) {
        var that = this;

        Tomahawk.asyncRequest(url, function(xhr) {
            var jsonResponse = JSON.parse(xhr.responseText);

            if (jsonResponse.success) {
                onSuccess(jsonResponse)
            } else if (jsonResponse.error) {
                Tomahawk.log("Error occured: " + that.errors[jsonResponse.error.code]);
            } else {
                Tomahawk.log("Unknown error occured");
            }
        });
    },
    convertTrack: function(synologyTrack) {
        return {
            artist: synologyTrack.artist,
            album: synologyTrack.album,
            track: synologyTrack.title,
            year: synologyTrack.year,
            albumpos: synologyTrack.track,
            discnumber: synologyTrack.disc,
            source: this.settings.name,
            url: this.buildStreamUrl(synologyTrack.res),
            bitrate: synologyTrack.bitrate / 1000,
            duration: synologyTrack.duration,
            size: synologyTrack.size,
            score: 1.0,
            mimetype: "audio/mpeg"
        };
    }
});

Tomahawk.resolver.instance = SynologyResolver;