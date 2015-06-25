/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2012, Thierry Göckel <thierry@strayrayday.lu>
 *   Copyright 2013, Uwe L. Korn <uwelk@xhochy.com>
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

var SoundcloudResolver = Tomahawk.extend(TomahawkResolver, {

    clientId: "TiNg2DRYhBnp01DA3zNag",

    settings: {
        name: 'SoundCloud',
        icon: 'soundcloud-icon.png',
        weight: 85,
        timeout: 15
    },

    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [
                {
                    name: "includeCovers",
                    widget: "covers",
                    property: "checked"
                },
                {
                    name: "includeRemixes",
                    widget: "remixes",
                    property: "checked"
                },
                {
                    name: "includeLive",
                    widget: "live",
                    property: "checked"
                }
            ],
            images: [
                {
                    "soundcloud.png": Tomahawk.readBase64("soundcloud.png")
                }
            ]
        };
    },

    newConfigSaved: function () {
        var userConfig = this.getUserConfig();
        if (userConfig.includeCovers != this.includeCovers
            || userConfig.includeRemixes != this.includeRemixes
            || userConfig.includeLive != this.includeLive) {
            this.includeCovers = userConfig.includeCovers;
            this.includeRemixes = userConfig.includeRemixes;
            this.includeLive = userConfig.includeLive;
        }
    },

    /**
     * Initial the soundcloud resolver.
     *
     * @param callback function(err) Callback that notifies when the resolver was initialised.
     */
    init: function (callback) {
        // Set userConfig here
        var userConfig = this.getUserConfig();
        if (userConfig) {
            this.includeCovers = userConfig.includeCovers;
            this.includeRemixes = userConfig.includeRemixes;
            this.includeLive = userConfig.includeLive;
        } else {
            this.includeCovers = false;
            this.includeRemixes = false;
            this.includeLive = false;
        }

        String.prototype.capitalize = function () {
            return this.replace(/(^|\s)([a-z])/g, function (m, p1, p2) {
                return p1 + p2.toUpperCase();
            });
        };
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);

        if (callback) {
            callback(null);
        }
    },

    _isValidTrack: function (trackTitle, origTitle) {
        if (!this.includeCovers &&
            trackTitle.search(/cover/i) >= 0 &&
            origTitle.search(/cover/i) < 0) {
            return false;
        }
        if (!this.includeRemixes &&
            trackTitle.search(/mix/i) >= 0 &&
            origTitle.search(/mix/i) < 0) {
            return false;
        }
        if (!this.includeLive &&
            trackTitle.search(/live/i) >= 0 &&
            origTitle.search(/live/i) < 0) {
            return false;
        }
        return true;
    },

    resolve: function (qid, artist, album, title) {
        var query;
        if (artist !== "") {
            query = encodeURIComponent(artist) + "+";
        }
        if (title !== "") {
            query += encodeURIComponent(title);
        }
        var apiQuery = "https://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q="
            + query;
        var that = this;
        var empty = {
            results: [],
            qid: qid
        };
        Tomahawk.asyncRequest(apiQuery, function (xhr) {
            var resp = JSON.parse(xhr.responseText);
            if (resp.length !== 0) {
                var results = [];
                for (var i = 0; i < resp.length; i++) {
                    // Need some more validation here
                    // This doesnt help it seems, or it just throws the error anyhow, and skips?
                    if (typeof(resp[i]) == 'undefined' || resp[i] === null) {
                        continue;
                    }

                    // Check for streamable tracks only
                    if (!resp[i].streamable) {
                        continue;
                    }

                    if (typeof(resp[i].title) != 'undefined' && resp[i].title !== null) {
                        // Check whether the artist and title (if set) are in the returned title, discard otherwise
                        // But also, the artist could be the username
                        if (resp[i].title.toLowerCase().indexOf(artist.toLowerCase()) === -1) {
                            continue;
                        }
                        if (resp[i].title.toLowerCase().indexOf(title.toLowerCase()) === -1) {
                            continue;
                        }

                        var result = {
                            artist: artist,
                            bitrate: 128,
                            mimetype: "audio/mpeg",
                            score: 0.85,
                            source: that.settings.name
                        };
                        if (that._isValidTrack(resp[i].title, title)) {
                            result.track = title;
                        } else {
                            continue;
                        }

                        result.duration = resp[i].duration / 1000;
                        result.year = resp[i].release_year;
                        result.url = resp[i].stream_url + ".json?client_id=TiNg2DRYhBnp01DA3zNag";
                        if (typeof(resp[i].permalink_url) != 'undefined' && resp[i].permalink_url
                            !== null) {
                            result.linkUrl = resp[i].permalink_url;
                        }
                        results.push(result);
                    }
                }
                if (results.length > 0) {
                    Tomahawk.addTrackResults({
                        qid: qid,
                        results: [results[0]]
                    });
                } else {
                    Tomahawk.addTrackResults(empty);
                }
            } else {
                Tomahawk.addTrackResults(empty);
            }
        });
    },

    _guessMetaData: function (title) {
        var matches = title.match(/\s*(.+?)\s*(?:\s[-\u2014]|\s["']|:)\s*["']?(.+?)["']?\s*$/);
        if (matches && matches.length > 2) {
            return {
                track: matches[2],
                artist: matches[1]
            };
        }
        matches = title.match(/\s*(.+?)\s*[-\u2014]+\s*(.+?)\s*$/);
        if (matches && matches.length > 2) {
            return {
                track: matches[2],
                artist: matches[1]
            };
        }
    },

    search: function (qid, searchString) {
        var apiQuery = "https://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q="
            + encodeURIComponent(searchString.replace('"', '').replace("'", ""));
        var that = this;
        var empty = {
            results: [],
            qid: qid
        };
        Tomahawk.asyncRequest(apiQuery, function (xhr) {
            var resp = JSON.parse(xhr.responseText);
            if (resp.length !== 0) {
                var results = [];
                var stop = resp.length;
                for (var i = 0; i < resp.length; i++) {
                    if (resp[i] === undefined) {
                        stop = stop - 1;
                        continue;
                    }
                    var result = {};

                    if (that._isValidTrack(resp[i].title, "")) {
                        var track = resp[i].title;
                        result = that._guessMetaData(track);
                        if (!result) {
                            if (resp[i].title !== "" && resp[i].user.username !== "") {
                                // Last resort, the artist is the username
                                result.track = resp[i].title;
                                result.artist = resp[i].user.username;
                            } else {
                                stop = stop - 1;
                                continue;
                            }
                        }
                    } else {
                        stop = stop - 1;
                        continue;
                    }

                    result.source = that.settings.name;
                    result.mimetype = "audio/mpeg";
                    result.bitrate = 128;
                    result.duration = resp[i].duration / 1000;
                    result.score = 0.85;
                    result.year = resp[i].release_year;
                    result.url = resp[i].stream_url + ".json?client_id=TiNg2DRYhBnp01DA3zNag";
                    if (resp[i].permalink_url !== undefined) {
                        result.linkUrl = resp[i].permalink_url;
                    }

                    (function (i, result) {
                        var artist = encodeURIComponent(result.artist.capitalize());
                        var url = "https://developer.echonest.com/api/v4/artist/extract?api_key=JRIHWEP6GPOER2QQ6&format=json&results=1&sort=hotttnesss-desc&text="
                            + artist;
                        Tomahawk.asyncRequest(url, function (xhr) {
                            var response = JSON.parse(xhr.responseText).response;
                            if (response && response.artists && response.artists.length > 0) {
                                artist = response.artists[0].name;
                                result.artist = artist;
                                result.id = i;
                                results.push(result);
                                stop = stop - 1;
                            } else {
                                stop = stop - 1;
                            }
                            if (stop === 0) {
                                function sortResults(a, b) {
                                    return a.id - b.id;
                                }

                                results = results.sort(sortResults);
                                for (var j = 0; j < results.length; j++) {
                                    delete results[j].id;
                                }
                                var toReturn = {
                                    results: results,
                                    qid: qid
                                };
                                Tomahawk.addTrackResults(toReturn);
                            }
                        });
                    })(i, result);
                }
                if (stop === 0) {
                    Tomahawk.addTrackResults(empty);
                }
            }
            else {
                Tomahawk.addTrackResults(empty);
            }
        });
    },

    canParseUrl: function (url, type) {
        // Soundcloud only returns tracks and playlists
        switch (type) {
            case TomahawkUrlType.Album:
                return false;
            case TomahawkUrlType.Artist:
                return false;
            default:
                return (/https?:\/\/(www\.)?soundcloud.com\//).test(url);
        }
    },

    _convertTrack: function (track) {
        var result = {
            type: "track",
            title: track.title,
            artist: track.user.username
        };

        if (!(track.stream_url === null || typeof track.stream_url === "undefined")) {
            result.hint = track.stream_url + "?client_id=" + this.clientId;
        }
        return result;
    },

    lookupUrl: function (url) {
        var query = "https://api.soundcloud.com/resolve.json?client_id=" + this.clientId + "&url="
            + encodeURIComponent(url.replace(/\/likes$/, ''));
        var that = this;
        Tomahawk.asyncRequest(query, function (xhr) {
            var res = JSON.parse(xhr.responseText);
            if (res.kind == "playlist") {
                var result = {
                    type: "playlist",
                    title: res.title,
                    guid: 'soundcloud-playlist-' + res.id.toString(),
                    info: res.description,
                    creator: res.user.username,
                    url: res.permalink_url,
                    tracks: []
                };
                res.tracks.forEach(function (item) {
                    result.tracks.push(that._convertTrack(item));
                });
                Tomahawk.addUrlResult(url, result);
            } else if (res.kind == "track") {
                Tomahawk.addUrlResult(url, that._convertTrack(res));
            } else if (res.kind == "user") {
                var url2 = res.uri;
                var prefix = 'soundcloud-';
                var title = res.full_name + "'s ";
                if (url.indexOf("/likes") === -1) {
                    url2 += "/tracks.json?client_id=" + that.clientId;
                    prefix += 'user-';
                    title += "Tracks";
                } else {
                    url2 += "/favorites.json?client_id=" + that.clientId;
                    prefix += 'favortites-';
                    title += "Favorites";
                }
                Tomahawk.asyncRequest(url2, function (xhr2) {
                    var res2 = JSON.parse(xhr2.responseText);
                    var result = {
                        type: "playlist",
                        title: title,
                        guid: prefix + res.id.toString(),
                        info: title,
                        creator: res.username,
                        url: res2.permalink_url,
                        tracks: []
                    };
                    res2.forEach(function (item) {
                        result.tracks.push(that._convertTrack(item));
                    });
                    Tomahawk.addUrlResult(url, result);
                });
            } else {
                Tomahawk.log("Could not parse SoundCloud URL: " + url);
                Tomahawk.addUrlResult(url, {});
            }
        });
    }
});

Tomahawk.resolver.instance = SoundcloudResolver;
