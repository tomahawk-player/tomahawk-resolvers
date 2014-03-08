/*
 *   Copyright 2014,      Uwe L. Korn <uwelk@xhochy.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 */

var BeatsMusicResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Beats Music',
        icon: 'beatsmusic.png',
        weight: 95,
        timeout: 15
    },

    // Production
    app_token: "<-- INSERT TOKEN HERE -->",
    endpoint: "https://partner.api.beatsmusic.com/v1",

    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [{
                name: "user",
                widget: "user_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }],
            images: [{
                "beatsmusic-wide.png" : Tomahawk.readBase64("beatsmusic-wide.png")
            }]
        };
    },

    newConfigSaved: function () {
        var userConfig = this.getUserConfig();
        Tomahawk.log("newConfigSaved User: " + userConfig.user);

        if (this.user !== userConfig.user || this.password !== userConfig.password)
        {
            this.init();
        }
    },


	init: function() {
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);

        Tomahawk.addCustomUrlHandler("beatsmusic", "getStreamUrl", true);

        var userConfig = this.getUserConfig();
        if (!userConfig.user || !userConfig.password) {
            Tomahawk.log("Beats Music Resolver not properly configured!");
            return;
        }

        this.user = userConfig.user;
        this.password = userConfig.password;
        this.loggedIn = false;
        var headers = {
            "Authorization": "Bearer " + this.app_token,
            "Content-type": "application/x-www-form-urlencoded"
        };

        var data =  "uuid=" + encodeURIComponent(Tomahawk.instanceUUID())
                + "&device_name=Tomahawk%20Player"
                + "&client_app_version=" + Tomahawk.apiVersion;
        var data2 = "login=" + encodeURIComponent(this.user)
                + "&password=" + encodeURIComponent(this.password)
                + "&uuid=" + encodeURIComponent(Tomahawk.instanceUUID());
        var that = this;
        Tomahawk.asyncRequest(this.endpoint + "/api/sessions", function (xhr) {
            var resp = JSON.parse(xhr.responseText);
            if (resp.code == "OK") {
                Tomahawk.asyncRequest(that.endpoint + "/api/auth/tokens", function (xhr2) {
                    that.loggedIn = true;
                    that.accessToken = JSON.parse(xhr2.responseText).data.access_token;
                }, headers, {
                    method: "POST",
                    data: data2
                });
            }
        }, headers, {
            method: "POST",
            data: data
        });
	},


    resolve: function (qid, artist, album, title) {
        if (!this.loggedIn) return;

        // TODO: Add album to search
        var headers = {
            "Authorization": "Bearer " + this.app_token,
        };
        var that = this;
        Tomahawk.asyncRequest(this.endpoint + "/api/search?type=track&filters=streamable:true&limit=1&q=" + encodeURIComponent(artist + " " + title) , function (xhr) {
            var res = JSON.parse(xhr.responseText);
            if (res.code == "OK" && res.info.count > 0) {
                // For the moment we just use the first result
                Tomahawk.asyncRequest(that.endpoint + "/api/tracks/" + res.data[0].id, function (xhr2) {
                    var res2 = JSON.parse(xhr2.responseText);
                    Tomahawk.addTrackResults({
                        qid: qid,
                        results: [{
                            artist: res2.data.artist_display_name,
                            duration: res2.data.duration,
                            source: that.settings.name,
                            track: res2.data.title,
                            url: "beatsmusic://track/" + res2.data.id
                        }]
                    });
                }, headers);
            } else {
                Tomahawk.addTrackResults({ results: [], qid: qid });
            }
        }, headers);
    },

    getStreamUrl: function (qid, url) {
        var headers = {
            "Authorization": "Bearer " + this.accessToken,
        };
        var trackId = url.replace("beatsmusic://track/", "");
        Tomahawk.asyncRequest(this.endpoint + "/api/tracks/" + trackId + "/audio?protocol=httpd&acquire=1" , function (xhr) {
            var res = JSON.parse(xhr.responseText);
            Tomahawk.reportStreamUrl(qid, res.data.location);
        }, headers);
    },

	search: function (qid, searchString) {
        var headers = {
            "Authorization": "Bearer " + this.accessToken,
        };
        var that = this;
        // TODO: Search for albums and artists, too.
        Tomahawk.asyncRequest(this.endpoint + "/api/search?filter=streamable:true&limit=200&type=track&q=" + encodeURIComponent(searchString), function (xhr) {
            var res = JSON.parse(xhr.responseText);
            if (res.code == "OK") {
                // TODO: Load more metatdata
                var results = res.data.map(function (item) {
                    return {
                        artist: item.detail,
                        source: that.settings.name,
                        track: item.display,
                        url: "beatsmusic://track/" + item.id
                    };
                });
                Tomahawk.addTrackResults({ results: results, qid: qid });
            }
        }, headers);
	},

    canParseUrl: function (url, type) {
        // We accept all beats.mu shortened urls as we need a HTTP request to get more information.
        if (/https?:\/\/beats.mu\//.test(url)) return true;

        switch (type) {
        case TomahawkUrlType.Album:
            return /https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/?$/.test(url);
        case TomahawkUrlType.Artist:
            return /https?:\/\/((on|listen)\.)?beatsmusic.com\/artists\/([^\/]*)\/?$/.test(url);
        case TomahawkUrlType.Playlist:
            return /https?:\/\/((on|listen)\.)?beatsmusic.com\/playlists\/([^\/]*)\/?$/.test(url);
        case TomahawkUrlType.Track:
            return /https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/tracks\//.test(url);
        // case TomahawkUrlType.Any:
        default:
            return /https?:\/\/((on|listen)\.)?beatsmusic.com\/([^\/]*\/|)/.test(url);
        }
    },

    lookupUrl: function (url) {
        // Todo: unshorten beats.mu

        var headers = {
            "Authorization": "Bearer " + this.app_token,
            "Content-type": "application/x-www-form-urlencoded"
        };
        if (/https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/?$/.test(url)) {
            // Found an album URL
            var match = url.match(/https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/?$/);
            var query = this.endpoint + "/api/albums/" + encodeURIComponent(match[3]);
            Tomahawk.asyncRequest(query, function (xhr) {
                var res = JSON.parse(xhr.responseText);
                if (res.code == "OK") {
                    Tomahawk.addUrlResult(url, {
                        type: "album",
                        name: res.data.title,
                        artist: res.data.artist_display_name,
                    })
                }
            }, headers);
        } else if (/https?:\/\/((on|listen)\.)?beatsmusic.com\/artists\/([^\/]*)\/?$/.test(url)) {
            var match = url.match(/https?:\/\/((on|listen)\.)?beatsmusic.com\/artists\/([^\/]*)\/?$/);
            var query = this.endpoint + "/api/artists/" + encodeURIComponent(match[3]);
            Tomahawk.asyncRequest(query, function (xhr) {
                var res = JSON.parse(xhr.responseText);
                if (res.code == "OK") {
                    Tomahawk.addUrlResult(url, {
                        type: "artist",
                        name: res.data.name
                    })
                }
            }, headers);
        } else if (/https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/tracks\//.test(url)) {
            var match = url.match(/https?:\/\/((on|listen)\.)?beatsmusic.com\/albums\/([^\/]*)\/tracks\/([^\/]*)/);
            var query = this.endpoint + "/api/tracks/" + encodeURIComponent(match[4]);
            Tomahawk.asyncRequest(query, function (xhr) {
                var res = JSON.parse(xhr.responseText);
                if (res.code == "OK") {
                    Tomahawk.addUrlResult(url, {
                        type: "track",
                        title: res.data.title,
                        artist: res.data.artist_display_name
                    });
                }
            }, headers);
        } else if (/https?:\/\/((on|listen)\.)?beatsmusic.com\/playlists\/([^\/]*)\/?$/.test(url)) {
            // TODO: Use user's access token if we have one to retrieve private playlists
            var match = url.match(/https?:\/\/((on|listen)\.)?beatsmusic.com\/playlists\/([^\/]*)\/?$/);
            var query = this.endpoint + "/api/playlists/" + encodeURIComponent(match[3]);
            var that = this;
            Tomahawk.asyncRequest(query, function (xhr) {
                var res = JSON.parse(xhr.responseText);
                if (res.code == "OK") {
                    var result = {
                        type: "playlist",
                        title: res.data.name,
                        guid: "beatsmusic-playlist-" + encodeURIComponent(match[3]),
                        info: res.data.description + " (A playlist by " + res.result.owner + " on Beats Music)",
                        creator: res.data.user_display_name,
                        url: url,
                        tracks: []
                    };
                    async.map(res.data.refs.tracks, function (item, cb) {
                        var query2 = that.endpoint + "/api/tracks/" + encodeURIComponent(item.id);
                        Tomahawk.asyncRequest(query2, function (xhr2) {
                            var res2 = JSON.parse(xhr2.responseText);
                            if (res2.code == "OK") {
                                cb(null, {
                                    type: "track",
                                    title: res2.data.title,
                                    artist: res2.data.artist_display_name
                                });
                            } else {
                                cb(res2.code, null);
                            }
                        });
                    }, function (err, mapresult) {
                        result.tracks = mapresult;
                        Tomahawk.addUrlResult(url, result);
                    });
                }
            }, headers);
        }
    }
});

Tomahawk.resolver.instance = BeatsMusicResolver;

