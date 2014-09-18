/*
 * Copyright (C) 2012-2014 Thierry Göckel <thierry@strayrayday.lu>
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

    spell: function(a){magic = function(b){return(b=(b)?b:this).split("").map(function(d){if(!d.match(/[A-Za-z]/)){return d;}c=d.charCodeAt(0)>=96;k=(d.toLowerCase().charCodeAt(0)-96+12)%26+1;return String.fromCharCode(k+(c?96:64));}).join("");};return magic(a);},                                       

    init: function () {
        this.secret = this.spell(this.wand);
    },

    resolve: function (qid, artist, album, title) {
        var findArtistUrl = "http://api.bandcamp.com/api/band/3/search?key=" + this.secret + "&name=" + encodeURIComponent(artist);
        var empty = {
            qid: qid,
            results: []
        };
        var that = this;
        Tomahawk.asyncRequest(findArtistUrl, function (xhr) {
            var response = JSON.parse(xhr.responseText);
            if (response.results.length !== 0) {
                var bandcampArtistId = response.results[0].band_id;
                var artistDiscographyUrl = "http://api.bandcamp.com/api/band/3/discography?key=" + that.secret + "&band_id=" + bandcampArtistId;
                Tomahawk.asyncRequest(artistDiscographyUrl, function (xhr1) {
                    var response1 = JSON.parse(xhr1.responseText);
                    var results = [];
                    if (response1.discography !== undefined && response1.discography.length !== 0) {
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
                                if (response1.discography[i].url !== undefined){
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
                                                if ((response2.tracks[k].title.toLowerCase() === title.toLowerCase() || (normalisedReturnedTrackName === normalisedTrackName && album === response2.title)) 
                                                    && response2.tracks[k].streaming_url) {
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

    search: function (qid, searchString) {
        var empty = {
            qid: qid,
            results: []
        };
        Tomahawk.addTrackResults(empty);
    },

    getArtistPageBase: function (fullUrl) {
        var baseUrl = "";
        if (fullUrl.indexOf(".bandcamp.com") == -1 && fullUrl.indexOf("/album/") != -1){
            baseUrl = fullUrl.substring(0, fullUrl.indexOf("/album/"));
        }
        else {
            baseUrl = fullUrl.slice(0, fullUrl.indexOf(".bandcamp.com") + 13);
        }
        return baseUrl;
    }
});

Tomahawk.resolver.instance = BandcampResolver;
