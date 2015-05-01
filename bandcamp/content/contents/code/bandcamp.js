/*
 * Copyright (C) 2012-2015 Thierry Göckel <thierry@strayrayday.lu>
 * Copyright (C) 2012 Leo Franchi <lfranchi@kde.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * NOTICE: This resolver and its intent, is for demonstrational purposes only
 **/
var BandcampResolver = Tomahawk.extend(TomahawkResolver, {
    wand: "inganwbxhyy",

    settings: {
        name: 'Bandcamp',
        weight: 90,
        icon: 'bandcamp-icon.png',
        timeout: 10
    },

    spell: function(a){"use strict";var magic=function(b){return(b=(b)?b:this).split("").map(function(d){if(!d.match(/[A-Za-z]/)){return d;}var c=d.charCodeAt(0)>=96;var k=(d.toLowerCase().charCodeAt(0)-96+12)%26+1;return String.fromCharCode(k+(c?96:64));}).join("");};return magic(a);},                                       

    init: function (callback) {
        "use strict";

        this.secret = this.spell(this.wand);


        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        if (callback) {
            callback(null);
        }
    },

    resolve: function (qid, artist, album, title) {
        "use strict";

        var findArtistUrl = "http://api.bandcamp.com/api/band/3/search?key=" + this.secret + "&name=" + encodeURIComponent(artist);
        var empty = {
            qid: qid,
            results: []
        };
        var that = this;
        Tomahawk.asyncRequest(findArtistUrl, function (xhr) {
            var response = JSON.parse(xhr.responseText);
            if (response.hasOwnProperty("results") && response.results.length !== 0) {
                var bandcampArtistId = response.results[0].band_id;
                var artistDiscographyUrl = "http://api.bandcamp.com/api/band/3/discography?key=" + that.secret + "&band_id=" + bandcampArtistId;
                Tomahawk.asyncRequest(artistDiscographyUrl, function (xhr1) {
                    var response1 = JSON.parse(xhr1.responseText);
                    var results = [];
                    if (response1.hasOwnProperty("discography") && response1.discography.length !== 0) {
                        var result = {};
                        for (var i = 0; i < response1.discography.length; i++) {
                            if (response1.discography[i].track_id && response1.discography[i].title.toLowerCase() === title.toLowerCase() && response1.discography[i].streaming_url) {
                                result.url = response1.discography[i].streaming_url;
                                result.artist = artist;
                                result.album = response1.title;
                                result.track = response1.discography[i].title;
                                result.bitrate = 128;
                                result.duration = response1.discography[i].duration;
                                result.score = 1;
                                result.mimetype = "audio/mpeg";
                                result.source = that.settings.name;
                                result.checked = true;
                                result.year = new Date(response1.release_date * 1000).getFullYear();
                                if (response1.discography[i].hasOwnProperty("url")){
                                    result.linkUrl = response1.discography[i].url;
                                }
                                results.push(result);
                            }
                        }
                        if (results.length !== 0) {
                            var toReturn = {
                                qid: qid,
                                results: results
                            };
                            Tomahawk.addTrackResults(toReturn);
                        } else {
                            var pendingJobs = response1.discography.length;
                            // We want to send only 1 addTrackResults call, at the end. But we have to fetch
                            // each album list individually and check if our track is in there.
                            var decrementAndSend = function () {
                                pendingJobs = pendingJobs - 1;
                                if (pendingJobs >= 0 && results.length > 0) {
                                    Tomahawk.addTrackResults({
                                        qid: qid,
                                        results: [results[0]]
                                    });
                                    pendingJobs = -1; // Don't send again
                                } else if (pendingJobs === 0) {
                                    Tomahawk.addTrackResults(empty);
                                }
                            };
                            for (var j = 0; j < response1.discography.length; j++) {
                                if (!response1.discography[j].album_id) {
                                    decrementAndSend();
                                    continue;
                                } else {
                                    var bandcampAlbumId = response1.discography[j].album_id;
                                    var albumInfoUrl = "http://api.bandcamp.com/api/album/2/info?key=" + that.secret + "&album_id=" + bandcampAlbumId;
                                    Tomahawk.asyncRequest(albumInfoUrl, function (xhr2) {
                                        var response2 = JSON.parse(xhr2.responseText);
                                        var albumUrl = response2.url;
                                        var albumBaseUrl = that.getArtistPageBase(albumUrl);
                                        if (response2.tracks.length !== 0) {
                                            var normalisedTrackName = title.toLowerCase().replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ");
                                            for (var k = 0; k < response2.tracks.length; k++) {
                                                var normalisedReturnedTrackName = response2.tracks[k].title.toLowerCase().replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ");
                                                if ((response2.tracks[k].title.toLowerCase() === title.toLowerCase() || (normalisedReturnedTrackName === normalisedTrackName && album === response2.title)) &&
                                                    response2.tracks[k].streaming_url) {
                                                    result.url = response2.tracks[k].streaming_url;
                                                    result.artist = artist;
                                                    result.album = response2.title;
                                                    result.track = response2.tracks[k].title;
                                                    result.bitrate = 128;
                                                    result.duration = response2.tracks[k].duration;
                                                    result.score = 1;
                                                    result.mimetype = "audio/mpeg";
                                                    result.source = that.settings.name;
                                                    result.checked = true;
                                                    result.year = new Date(response2.release_date * 1000).getFullYear();
                                                    if (response2.tracks[k].url){
                                                        result.linkUrl = albumBaseUrl + response2.tracks[k].url;
                                                    }
                                                    else {
                                                        result.linkUrl = albumUrl;
                                                    }
                                                    results.push(result);
                                                }
                                            }
                                        }
                                        decrementAndSend();
                                    });
                                }
                            }
                        }
                    } else {
                        Tomahawk.addTrackResults(empty);
                    }
                });
            } else {
                Tomahawk.addTrackResults(empty);
            }
        });
    },

    canParseUrl: function (url, type) {
        "use strict";
	// This excludes bandcamp pages with a custom (non .bandcamp.com) URL
        if (!(/https?:\/\/(?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9]\.bandcamp.com\//).test(url)){
	    return false;
        }

        switch (type) {
            case TomahawkUrlType.Album: //Don't rely on Tomahawk's InfoPlugins for Bandcamp's mostly rather unknown bands & albums
                return false; // Albums are opened as playlists instead
            case TomahawkUrlType.Artist:
                return true;
            case TomahawkUrlType.Playlist:
                return true;
            case TomahawkUrlType.Track:
                return true;
            default:
                return true;
        }
    },

    track2Result: function (track) {
        "use strict";
        var result = {
            type: "track",
            title: track.title
        };
        if (track.hasOwnProperty("streaming_url")){
            result.hint = track.streaming_url;
        }
        return result;
    },

    lookupUrl: function (url) {
        "use strict";
        var query = "http://api.bandcamp.com/api/url/1/info?key=" + this.secret + "&url=" + url;
        var result = {};
        var that = this;
        Tomahawk.asyncRequest(query, function (xhr) {
            var response = JSON.parse(xhr.responseText);
            if (response.hasOwnProperty("band_id")){
                if (response.hasOwnProperty("track_id")){
                    result.type = "track";
                    query = "http://api.bandcamp.com/api/track/3/info?key=" + that.secret + "&track_id=" + response.track_id;
                }
                else if (response.hasOwnProperty("album_id")){
                    result.type = "playlist";
                    result.guid = "bandcamp-album-playlist-" + response.album_id;
                    query = "http://api.bandcamp.com/api/album/2/info?key=" + that.secret + "&album_id=" + response.album_id;
                }
                else {
                    result.type = "artist";
                    query = "http://api.bandcamp.com/api/band/3/discography?key=" + that.secret + "&band_id=" + response.band_id;
                }
                Tomahawk.asyncRequest(query, function (xhr2) {
                    var response2 = JSON.parse(xhr2.responseText);
                    if (result.type === "track" && response2.hasOwnProperty("title")){
                        result = that.track2Result(response2);
                        if (response2.hasOwnProperty("artist")){
                            result.artist = response2.artist;
                        }
                    } else if (result.type === "playlist" && response2.hasOwnProperty("tracks")){
                        if (response2.hasOwnProperty("artist")){
                            result.title = "\"" + response2.title + "\" by \"" + response2.artist + "\"";
                            result.artist = response2.artist;
                        } else {
                            result.title = response2.title;
                        }
                        if (response2.hasOwnProperty("about")){
                            result.description = response2.about;
                        }
                        result.tracks = [];
                        response2.tracks.forEach(function (track){
                            track = that.track2Result(track);
                            if (response2.hasOwnProperty("artist")){
                                track.artist = response2.artist;
                            }
                            result.tracks.push(track);
                        });
                    } else if (result.type !== "artist"){
                        Tomahawk.addUrlResult(url, {});
                        return;
                    }
                    if (!result.hasOwnProperty("artist")){
                        query = "http://api.bandcamp.com/api/band/3/info?key=" + that.secret + "&band_id=" + response.band_id;
                        Tomahawk.asyncRequest(query, function (xhr3) {
                            var response3 = JSON.parse(xhr3.responseText);
                            if (response3.hasOwnProperty("name")){
                                if (result.type === "playlist"){
                                    result.artist = response3.name;
                                    result.title = "\"" + result.title + "\" by \"" + result.artist + "\"";
                                    if (result.hasOwnProperty("tracks")){
                                        for (var i = 0; i < result.tracks.length; i++){
                                            result.tracks[i].artist = result.artist;
                                        }
                                    }
                                } else if (result.type === "artist"){
                                    result.name = response3.name;
                                } else {
                                    result.artist = response3.name;
                                }
                                Tomahawk.addUrlResult(url, result);
                            } else {
                                Tomahawk.addUrlResult(url, {});
                            }
                        });
                    } else {
                        Tomahawk.addUrlResult(url, result);
                    }
                });
            } else {
                Tomahawk.addUrlResult(url, {});
            }   
        });
    },

    search: function (qid, searchString) {
        "use strict";

        var empty = {
            qid: qid,
            results: []
        };
        Tomahawk.addTrackResults(empty);
    },

    getArtistPageBase: function (fullUrl) {
        "use strict";

        var baseUrl = "";
        if (fullUrl.indexOf(".bandcamp.com") === -1 && fullUrl.indexOf("/album/") !== -1){
            baseUrl = fullUrl.substring(0, fullUrl.indexOf("/album/"));
        }
        else {
            baseUrl = fullUrl.slice(0, fullUrl.indexOf(".bandcamp.com") + 13);
        }
        return baseUrl;
    }
});

Tomahawk.resolver.instance = BandcampResolver;
