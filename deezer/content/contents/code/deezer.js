/*
 *   Copyright 2013,      Uwe L. Korn <uwelk@xhochy.com>
 *   Copyright 2014,      Enno Gottschalk <mrmaffen@googlemail.com>
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

var DeezerResolver = Tomahawk.extend(Tomahawk.Resolver, {

    apiVersion: 0.9,

    settings: {
        name: 'Deezer',
        icon: 'deezer.png',
        weight: 95,
        timeout: 15
    },

    appId: "138751",

    // Deezer requires the redirectUri to be in the domain that has been defined when
    // Tomahawk-Android has been registered on the Deezer Developer website
    redirectUri: "tomahawkdeezerresolver://hatchet.is",

    storageKeyAccessToken: "deezer_access_token",

    storageKeyAccessTokenExpires: "deezer_access_token_expires",

    getAccessToken: function () {
        var that = this;

        var accessToken = Tomahawk.localStorage.getItem(that.storageKeyAccessToken);
        var accessTokenExpires =
            Tomahawk.localStorage.getItem(that.storageKeyAccessTokenExpires);
        if (accessToken !== null && accessToken.length > 0 && accessTokenExpires !== null) {
            return {
                accessToken: accessToken,
                accessTokenExpires: accessTokenExpires
            };
        } else {
            throw  new Error("There's no accessToken set.");
        }
    },

    login: function () {
        Tomahawk.log("Starting login");

        var authUrl = "https://connect.deezer.com/oauth/auth.php";
        authUrl += "?app_id=" + this.appId;
        authUrl += "&redirect_uri=" + encodeURIComponent(this.redirectUri);
        authUrl += "&perms=offline_access";
        authUrl += "&response_type=token";

        var that = this;

        var params = {
            url: authUrl
        };
        return Tomahawk.NativeScriptJobManager.invoke("showWebView", params).then(
            function (result) {
                var error = that._getParameterByName(result.url, "error_reason");
                if (error) {
                    Tomahawk.log("Authorization failed: " + error);
                    return error;
                } else {
                    Tomahawk.log("Authorization successful, received new access token ...");
                    that.accessToken = that._getParameterByName(result.url, "access_token");
                    that.accessTokenExpires = that._getParameterByName(result.url, "expires");
                    Tomahawk.localStorage.setItem(that.storageKeyAccessToken, that.accessToken);
                    Tomahawk.localStorage.setItem(that.storageKeyAccessTokenExpires,
                        that.accessTokenExpires);
                    return TomahawkConfigTestResultType.Success;
                }
            });
    },

    logout: function () {
        Tomahawk.localStorage.removeItem(this.storageKeyAccessToken);
        return TomahawkConfigTestResultType.Logout;
    },

    isLoggedIn: function () {
        var accessToken = Tomahawk.localStorage.getItem(this.storageKeyAccessToken);
        return accessToken !== null && accessToken.length > 0;
    },

    /**
     * Returns the value of the query parameter with the given name from the given URL.
     */
    _getParameterByName: function (url, name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&#]" + name + "=([^&#]*)"), results = regex.exec(url);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    },

    init: function () {
        Tomahawk.PluginManager.registerPlugin("linkParser", this);

        this.accessToken = Tomahawk.localStorage.getItem(this.storageKeyAccessToken);
        this.accessTokenExpires = Tomahawk.localStorage.getItem(this.storageKeyAccessTokenExpires);
    },

    resolve: function (params) {
        var artist = params.artist;
        var album = params.album;
        var track = params.track;

        var that = this;

        var queryPart;
        if (artist) {
            queryPart = artist + " " + track;
        } else {
            queryPart = track;
        }
        var query = "http://api.deezer.com/search?q=" + encodeURIComponent(queryPart)
            + "&limit=100";
        return Tomahawk.get(query).then(function (response) {
            var results = [];
            for (var i = 0; i < response.data.length; i++) {
                var item = response.data[i];
                if (item.type == 'track' && item.readable) {
                    results.push({
                        source: that.settings.name,
                        artist: item.artist.name,
                        track: item.title,
                        duration: item.duration,
                        url: "deezer://track/" + item.id,
                        album: item.album.title,
                        linkUrl: item.link
                    });
                }
            }
            return results;
        });
    },

    search: function (params) {
        var query = params.query;

        return this.resolve({
            track: query
        });
    },

    canParseUrl: function (params) {
        var url = params.url;
        var type = params.type;

        if (!url) {
            throw new Error("Provided url was empty or null!");
        }
        switch (type) {
            case TomahawkUrlType.Album:
                return /https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)album\//.test(url);
            case TomahawkUrlType.Artist:
                return /https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)artist\//.test(url);
            case TomahawkUrlType.Playlist:
                return /https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)playlist\//.test(url);
            case TomahawkUrlType.Track:
                return /https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)track\//.test(url);
            // case TomahawkUrlType.Any:
            default:
                return /https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)/.test(url);
        }
    },

    lookupUrl: function (params) {
        var url = params.url;
        Tomahawk.log("lookupUrl: " + url);

        var urlParts = url.split('/').filter(function (item) {
            return item.length != 0;
        }).map(decodeURIComponent);

        if (/https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)artist\//.test(url)) {
            // We have to deal with an artist
            var query = 'https://api.deezer.com/2.0/artist/' + urlParts[urlParts.length - 1];
            return Tomahawk.get(query).then(function (response) {
                return {
                    type: Tomahawk.UrlType.Artist,
                    artist: response.name
                };
            });
        } else if (/https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)playlist\//.test(url)) {
            // We have to deal with a playlist.
            var query = 'https://api.deezer.com/2.0/playlist/' + urlParts[urlParts.length - 1];
            return Tomahawk.get(query).then(function (res) {
                var query2 = 'https://api.deezer.com/2.0/playlist/' + res.creator.id;
                return Tomahawk.get(query2).then(function (res2) {
                    return {
                        type: Tomahawk.UrlType.Playlist,
                        title: res.title,
                        guid: "deezer-playlist-" + res.id.toString(),
                        info: "A playlist by " + res2.name + " on Deezer.",
                        creator: res2.name,
                        linkUrl: res.link,
                        tracks: res.tracks.data.map(function (item) {
                            return {
                                type: Tomahawk.UrlType.Track,
                                track: item.title,
                                artist: item.artist.name
                            };
                        })
                    };
                });
            });
        } else if (/https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)track\//.test(url)) {
            // We have to deal with a track.
            var query = 'https://api.deezer.com/2.0/track/' + urlParts[urlParts.length - 1];
            return Tomahawk.get(query).then(function (res) {
                return {
                    type: Tomahawk.UrlType.Track,
                    track: res.title,
                    artist: res.artist.name
                };
            });
        } else if (/https?:\/\/(www\.)?deezer.com\/([^\/]*\/|)album\//.test(url)) {
            // We have to deal with an album.
            var query = 'https://api.deezer.com/2.0/album/' + urlParts[urlParts.length - 1];
            return Tomahawk.get(query).then(function (res) {
                return {
                    type: Tomahawk.UrlType.Album,
                    album: res.title,
                    artist: res.artist.name
                };
            });
        }
    }
});

Tomahawk.resolver.instance = DeezerResolver;

Tomahawk.PluginManager.registerPlugin('infoPlugin', {

    _convertArtist: function (artist) {
        var result = {
            id: "",
            artist: "",
            bio: "",
            images: [],
            tracks: [],
            albums: [],
            similar: []
        };
        if (artist) {
            if (typeof artist == 'string' || artist instanceof String) {
                result.artist = artist;
            } else {
                result.id = artist.id;
                result.artist = artist.name;
                if (artist.picture_medium) {
                    result.images.push({url: artist.picture_medium});
                }
                if (artist.picture_xl) {
                    result.images.push({url: artist.picture_xl});
                } else if (artist.picture_big) {
                    result.images.push({url: artist.picture_big});
                }
            }
        }
        return result;
    },

    _convertArtists: function (artists) {
        var that = this;

        var result = [];
        if (artists) {
            artists.forEach(function (artist) {
                result.push(that._convertArtist(artist));
            });
        }
        return result;
    },

    _convertAlbum: function (album, artistName) {
        var result = {
            id: "",
            album: "",
            artist: this._convertArtist(),
            composer: "",
            date: 0,     // in Unix time
            genre: "",
            images: []  // list of album image urls (low res first)
        };
        if (album) {
            result.id = album.id;
            result.album = album.title;
            result.artist = artistName ?
                this._convertArtist(artistName) : this._convertArtist(album.artist);
            if (album.cover_medium) {
                result.images.push({url: album.cover_medium});
            }
            if (album.cover_xl) {
                result.images.push({url: album.cover_xl});
            } else if (album.cover_big) {
                result.images.push({url: album.cover_big});
            }
        }
        return result;
    },

    _convertAlbums: function (albums, artistName) {
        var that = this;

        var result = [];
        if (albums) {
            albums.forEach(function (album) {
                result.push(that._convertAlbum(album, artistName));
            });
        }
        return result;
    },

    _convertTracks: function (tracks) {
        var that = this;

        var result = [];
        if (tracks) {
            tracks.forEach(function (track) {
                result.push({
                    id: track.id,
                    track: track.title,
                    artist: that._convertArtist(track.artist),
                    album: that._convertAlbum(track.album),
                    composer: "",
                    date: 0,        // in Unix time
                    genre: "",
                    number: 0,
                    discnumber: 0,
                    bitrate: 0,     // in kbps
                    duration: track.duration,    // in ms
                    samplerate: 0,  // in hz
                    filesize: 0,    // in kb
                    bpm: 0,
                    lyrics: "",
                    similar: []     // list of similar track's ids
                });
            });
        }
        return result;
    },

    search: function (params) {
        var that = this;

        var query = params.query;
        var suggestions = params.suggestions;

        var artistUrl = 'http://api.deezer.com/search/artist';
        var artistSettings = {
            data: {
                q: query
            }
        };
        if (suggestions) {
            artistSettings.limit = 3;
        }
        var albumUrl = 'http://api.deezer.com/search/album';
        var albumSettings = {
            data: {
                q: query
            }
        };
        if (suggestions) {
            albumSettings.limit = 1;
        }
        var promises = [
            Tomahawk.get(artistUrl, artistSettings),
            Tomahawk.get(albumUrl, albumSettings)
        ];
        return RSVP.all(promises).then(function (results) {
            return {
                artists: that._convertArtists(results[0].data),
                albums: that._convertAlbums(results[1].data)
            };
        });
    },

    artist: function (params) {
        var that = this;

        var id = params.id;
        var artistName = params.artist;

        var artistPromise;
        if (id) {
            artistPromise = that._artistById(id);
        } else {
            var artistUrl = 'http://api.deezer.com/search/artist';
            var artistSettings = {
                data: {
                    q: artistName,
                    limit: 20
                }
            };
            artistPromise = Tomahawk.get(artistUrl, artistSettings).then(function (response) {
                var artist = null;
                if (response.data) {
                    for (var i = 0; i < response.data.length; i++) {
                        var rawArtist = response.data[i];
                        if (rawArtist.name == artistName) {
                            artist = that._convertArtist(rawArtist);
                            break;
                        }
                    }
                }
                if (artist == null) {
                    artist = that._convertArtist();
                }
                return artist;
            })
        }
        return artistPromise.then(function (result) {
            if (params.short || !result.id) {
                return result;
            } else {
                var promises = [];

                var topTracksUrl = 'http://api.deezer.com/artist/' + result.id + "/top";
                var topTracksSettings = {
                    data: {
                        limit: 50
                    }
                };
                promises.push(Tomahawk.get(topTracksUrl, topTracksSettings)
                    .then(function (response) {
                        return that._convertTracks(response.data);
                    }));

                var albumsUrl = 'http://api.deezer.com/artist/' + result.id + "/albums";
                var albumsSettings = {
                    data: {
                        limit: 50
                    }
                };
                promises.push(Tomahawk.get(albumsUrl, albumsSettings)
                    .then(function (response) {
                        return that._convertAlbums(response.data, result.artist);
                    }));

                return RSVP.all(promises).then(function (results) {
                    result.tracks = results[0];
                    result.albums = results[1];
                    return result;
                });
            }
        });
    },

    _artistById: function (id) {
        var that = this;

        var artistUrl = 'http://api.deezer.com/artist/' + id;
        return Tomahawk.get(artistUrl).then(function (response) {
            return that._convertArtist(response);
        });
    },

    album: function (params) {
        var that = this;

        var id = params.id;
        var artistName = params.artist;
        var albumName = params.album;

        if (id) {
            return that._albumById(id);
        }

        var albumUrl = 'http://api.deezer.com/search/album';
        var albumSettings = {
            data: {
                q: artistName + " " + albumName,
                limit: 20
            }
        };
        return Tomahawk.get(albumUrl, albumSettings).then(function (response) {
            var album = null;
            if (response.data) {
                for (var i = 0; i < response.data.length; i++) {
                    var rawAlbum = response.data[i];
                    if (rawAlbum.title == albumName && rawAlbum.artist.name == artistName) {
                        album = that._convertAlbum(rawAlbum);
                        break;
                    }
                }
            }
            if (album == null) {
                album = that._convertAlbum();
            }
            return album;
        }).then(function (result) {
            if (params.short || !result.id) {
                return result;
            } else {
                var tracksUrl = 'http://api.deezer.com/album/' + result.id + "/tracks";
                return Tomahawk.get(tracksUrl).then(function (response) {
                    Tomahawk.log("album not short request: " + response.data.length);
                    result.tracks = that._convertTracks(response.data);
                    if (response.data.length > 0) {
                        Tomahawk.log(
                            "album not short request2: " + JSON.stringify(response.data[0]));
                        Tomahawk.log(
                            "album not short request3: " + JSON.stringify(result.tracks[0]));
                    }
                    return result;
                })
            }
        });
    },

    _albumById: function (id) {
        var that = this;

        var albumUrl = 'http://api.deezer.com/album/' + id;
        return Tomahawk.get(albumUrl).then(function (response) {
            var album = that._convertAlbum(response);
            if (response.tracks) {
                album.tracks = that._convertTracks(response.tracks.data);
            }
            return album;
        });
    }

});
