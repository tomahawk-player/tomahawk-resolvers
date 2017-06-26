/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011-2015, Thierry Göckel <thierry@strayrayday.lu>
 *   Copyright 2017, Enno Gottschalk <mrmaffen@googlemail.com>
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as
 *   published by the Free Software Foundation, version 3.
 *
 *   Tomahawk is distributed in the hope that it will be useful, but
 *   WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 *   Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var LastfmResolver = Tomahawk.extend(TomahawkResolver, {

    settings: {
        name: 'Last.fm',
        icon: 'lastfm-icon.png',
        weight: 85,
        timeout: 5
    },

    init: function () {
        Tomahawk.PluginManager.registerPlugin("linkParser", this);
    },

    canParseUrl: function (params) {
        var url = params.url;
        var type = params.type;

        switch (type) {
            case Tomahawk.UrlType.Album:
                return /^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n]+\/[^\/\n]+$/.test(url);
            case Tomahawk.UrlType.Artist:
                return /^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n][^\/\n_]+$/.test(url);
            case Tomahawk.UrlType.Track:
                return /^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n]+\/_\/[^\/\n]+$/.test(url);
            default:
                return false;
        }
    },

    lookupUrl: function (params) {
        var url = params.url;

        Tomahawk.log("lookupUrl: " + url);
        var urlParts =
            url.split('/').filter(function (item) {
                return item.length != 0;
            }).map(function (s) {
                return decodeURIComponent(s.replace(/\+/g, '%20'));
            });
        if (/^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n]+\/[^\/\n]+$/.test(url)) {
            Tomahawk.log("Found an album");
            // We have to deal with an Album
            return {
                type: Tomahawk.UrlType.Album,
                artist: urlParts[urlParts.length - 2],
                album: urlParts[urlParts.length - 1]
            };
        } else if (/^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n][^\/\n_]+$/.test(url)) {
            Tomahawk.log("Found an artist");
            // We have to deal with an Artist
            return {
                type: Tomahawk.UrlType.Artist,
                artist: urlParts[urlParts.length - 1]
            };
        } else if (/^https?:\/\/((www|cn)\.last\.).+\/music\/[^\/\n]+\/_\/[^\/\n]+$/.test(url)) {
            Tomahawk.log("Found a track");
            // We have to deal with a Track
            return {
                type: Tomahawk.UrlType.Track,
                artist: urlParts[urlParts.length - 3],
                track: urlParts[urlParts.length - 1]
            };
        }
    }
});

Tomahawk.resolver.instance = LastfmResolver;

Tomahawk.PluginManager.registerPlugin('infoPlugin', {

    _apiUrl: 'http://ws.audioscrobbler.com/2.0/',

    _apiKey: '7194b85b6d1f424fe1668173a78c0c4a',

    _apiSecret: '59edd383762b4f933c059a527423dc0e',

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
                result.id = artist.mbid;
                result.artist = artist.name;
                result.bio = artist.bio ? artist.bio.content : "";
                result.images = this._convertImages(artist.image);
                result.similar = artist.similar ? this._convertArtists(artist.similar.artist) : [];
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

    _convertImages: function (images) {
        var result = [];
        if (images) {
            images.forEach(function (image) {
                if (image["#text"] && image.size
                    && (image.size == "medium" || image.size == "extralarge")) {
                    result.push({
                        url: image["#text"]
                    });
                }
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
                    id: track.mbid,
                    track: track.name,
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

    _convertAlbum: function (album) {
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
            result = {
                id: album.mbid,
                album: album.name,
                artist: this._convertArtist(album.artist),
                composer: "",
                date: 0,  // in Unix time
                genre: "",
                images: this._convertImages(album.image),  // list of album image urls (low res first)
            };
            if (album.tracks && album.tracks.track && album.tracks.track.length > 0) {
                result.tracks = this._convertTracks(album.tracks.track);
            }
        }
        return result;
    },

    _convertAlbums: function (albums) {
        var that = this;

        if (albums) {
            var promises = [];
            albums.forEach(function (album) {
                if (album && album.image && album.name && album.artist && album.artist.name
                    && album.image.length > 0 && album.image[0]["#text"]) {
                    var params = {
                        album: album.name,
                        artist: album.artist.name
                    };
                    promises.push(that.album(params));
                }
            });
        }
        return RSVP.all(promises).then(function (albums) {
            var validAlbums = [];
            if (albums) {
                albums.forEach(function (album) {
                    if (album.tracks) {
                        validAlbums.push(album);
                    }
                });
            }
            return validAlbums;
        });
    },

    _apiRequest: function (method, optionsData) {
        optionsData.method = method;
        optionsData.api_key = this._apiKey;
        optionsData.format = "json";
        var options = {
            data: optionsData
        };
        return Tomahawk.get(this._apiUrl, options);
    },

    /**
     * Search for tracks, artists and albums
     *
     * @param params A map containing all of the necessary parameters describing the query
     *
     *               Example:
     *               { query: "Queen" }
     *
     * @returns A map consisting of the contentType and parsed results.
     *
     *          Example:
     *          {
     *            artists: [],
     *            albums: [],
     *            tracks: []
     *          }
     *
     */
    search: function (params) {
        var that = this;

        var query = params.query;

        if (params.suggestions) {
            return;
        }

        var promises = [];

        promises.push(that._apiRequest("artist.search", {artist: query}).then(function (result) {
            return that._convertArtists(result.results.artistmatches.artist);
        }));
        promises.push(
            that._apiRequest("album.search", {limit: 20, album: query}).then(function (result) {
                return that._convertAlbums(result.results.albummatches.album);
            }));
        return RSVP.all(promises).then(function (results) {
            return {
                artists: results[0],
                albums: results[1],
                tracks: []
            }
        });
    },

    /**
     * Get the artist info from the server specified by the given params map and parse them into the
     * correct result format.
     *
     * @param params A map containing all of the necessary parameters describing the artist which to
     *               get infos from the server for.
     *
     *               Example:
     *               { name: "Queen",   // the artist's name
     *                 short: true   }  // if true, only basic information is being fetched
     *
     * @returns A map containing the parsed results.
     *
     *          Example:
     *          {
     *            id: "421421",
     *            name: "Queen",
     *            bio: "Queen is da best. For real!",
     *            images: ["http://www.img.de/queen_small.png",   // list of artist image urls (low res first)
      *                    "http://www.img.de/queen_medium.png",
      *                    "http://www.img.de/queen_large.png"],
     *            tracks: [],     // list of track objects
     *            similar: []     // list of similar artists
     *          }
     *
     */
    artist: function (params) {
        var that = this;

        var artistName = params.artist;

        return that._apiRequest("artist.getinfo", {artist: artistName}).then(function (result) {
            return that._convertArtist(result.artist);
        }).then(function (result) {
            if (params.short) {
                return result;
            } else {
                var promises = [];
                promises.push(that._apiRequest(
                    "artist.gettopalbums", {limit: 20, artist: artistName})
                    .then(function (result) {
                        return that._convertAlbums(result.topalbums.album);
                    }));
                promises.push(that._apiRequest("artist.gettoptracks", {artist: artistName})
                    .then(function (result) {
                        return that._convertTracks(result.toptracks.track);
                    }));
                return RSVP.all(promises).then(function (results) {
                    result.albums = results[0];
                    result.tracks = results[1];
                    return result;
                }).catch(function (reason) {
                    reject("search error! " + reason);
                });
            }
        });
    },

    /**
     * Get the album info from the server specified by the given params map and parse them into the
     * correct result format.
     *
     * @param params A map containing all of the necessary parameters describing the album which to
     *               get infos from the server for.
     *
     *               Example:
     *               { album: "Greatest Hits",   // the album's name
     *                 artist: "Queen",    // the artist's name
     *                 short: true   }          // if true, only basic information is being fetched
     *
     * @returns A map containing the parsed results.
     *
     *          Example:
     *          {
     *           id: "25525252",
     *           name: "Greatest Hits",
     *           artist: {name: "Queen", ...},
     *           composer: "",
     *           date: 1484086490,  // in Unix time
     *           genre: "Rock",
     *           images: ["http://www.img.de/greatesthits_small.png",   // list of album image urls (low res first)
      *                   "http://www.img.de/greatesthits_medium.png",
      *                   "http://www.img.de/greatesthits_large.png"],
     *           tracks: [],     // list of track objects
     *          }
     *
     */
    album: function (params) {
        var that = this;

        var artistName = params.artist;
        var albumName = params.album;

        return that._apiRequest("album.getinfo", {artist: artistName, album: albumName})
            .then(function (result) {
                return that._convertAlbum(result.album);
            });
    }
});