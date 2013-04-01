/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2012, Adrian Sampson <adrian@radbox.org>
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

// Map all the audio types supported by beets to extensions and MIME types.
var AUDIO_TYPES = {
    'MP3':      ['mp3',  'audio/mpeg'],
    'AAC':      ['m4a',  'audio/mp4'],
    'OGG':      ['ogg',  'audio/ogg'],
    'FLAC':     ['flac', 'audio/x-flac'],
    'APE':      ['ape',  'audio/ape'],
    'WavPack':  ['wv',   'audio/x-wavpack'],
    'MusePack': ['mpc',  'audio/x-musepack']
};

var BeetsResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'beets',
        icon: 'beets-icon.png',
        weight: 95,
        timeout: 5
    },

    // Resolution.
    resolve: function (qid, artist, album, title) {
        this.beetsQuery(qid, ['artist:' + artist, 'album:' + album, 'title:' + title]);
    },

    search: function (qid, searchString) {
        this.beetsQuery(qid, searchString.split(' '));
    },

    baseUrl: function () {
        return 'http://' + this.host + ':' + this.port;
    },

    beetsQuery: function (qid, queryParts) {
        var baseUrl = this.baseUrl(),
            url = this.baseUrl() + '/item/query/';
        queryParts.forEach(function (item) {
            url += encodeURIComponent(item);
            url += '/';
        });
        url = url.substring(0, url.length - 1);  // Remove last /.

        Tomahawk.asyncRequest(url, function (xhr) {
            var resp = JSON.parse(xhr.responseText),
                items = resp.results,
                searchResults = [];
            items.forEach(function (item) {
                var type_info = AUDIO_TYPES[item.format];
                searchResults.push({
                    artist: item.artist,
                    album: item.album,
                    track: item.title,
                    albumpos: item.track,
                    source: "beets",
                    url: baseUrl + '/item/' + item.id + '/file',
                    bitrate: Math.floor(item.bitrate / 1024),
                    duration: Math.floor(item.length),
                    size: (item.size || 0),
                    score: 1.0,
                    extension: type_info[0],
                    mimetype: type_info[1],
                    year: item.year
                });
            });
            Tomahawk.addTrackResults({
                qid: qid,
                results: searchResults
            });
        });
    },

    // Configuration.
    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            "fields": [{
                name: "host",
                widget: "hostField",
                property: "text"
            }, {
                name: "port",
                widget: "portField",
                property: "text"
            }]
        };
    },
    newConfigSaved: function () {
        this.init();
    },
    init: function () {
        var userConfig = this.getUserConfig(),
            xmlHttpRequest = new XMLHttpRequest();
        this.host = userConfig.host || 'localhost';
        this.port = parseInt(userConfig.port, 10);
        if (isNaN(this.port) || !this.port) {
            this.port = 8337;
        }
        // Check if /artist/ is available and we can get enough information for ScriptCollection support
        xmlHttpRequest.open('GET', this.baseUrl() + '/artist/', true);
        xmlHttpRequest.onreadystatechange = function() {
            if (xmlHttpRequest.readyState == 4 && xmlHttpRequest.status == 200) {
                Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
            } else if (xmlHttpRequest.readyState === 4) {
                Tomahawk.reportCapabilities();
            }
        }
        xmlHttpRequest.send(null);
    },

    // Script Collection Support

    artists: function (qid) {
        var url = this.baseUrl() + '/artist/';
        Tomahawk.asyncRequest(url, function (xhr) {
            var response = JSON.parse(xhr.responseText);
            Tomahawk.addArtistResults({
                qid: qid,
                artists: response.artist_names
            });
        });
    },

    albums: function (qid, artist) {
        var url = this.baseUrl() + '/album/artist/' + encodeURIComponent(artist);
        Tomahawk.asyncRequest(url, function (xhr) {
            var response = JSON.parse(xhr.responseText),
                results = [];
            response.results.forEach(function (item) {
                results.push(item.album);
            });
            Tomahawk.addAlbumResults({
                qid: qid,
                artist: artist,
                albums: results
            });
        });
    },

    tracks: function (qid, artist, album) {
        var url = this.baseUrl() + '/item/query/' + encodeURIComponent('artist:' + artist) + '/' + encodeURIComponent('album:' + album),
            baseUrl = this.baseUrl();
        Tomahawk.asyncRequest(url, function (xhr) {
            var response = JSON.parse(xhr.responseText),
                searchResults = [];
            response.results.forEach(function (item) {
                var type_info = AUDIO_TYPES[item.format];
                searchResults.push({
                    artist: item.artist,
                    album: item.album,
                    track: item.title,
                    albumpos: item.track,
                    source: "beets",
                    url: baseUrl + '/item/' + item.id + '/file',
                    bitrate: Math.floor(item.bitrate / 1024),
                    duration: Math.floor(item.length),
                    size: (item.size || 0),
                    score: 1.0,
                    extension: type_info[0],
                    mimetype: type_info[1],
                    year: item.year
                });
            });
            searchResults.sort(function (a, b) {
                if (a.albumpos < b.albumpos) {
                    return -1;
                } else if (a.albumpos > b.albumpos) {
                    return 1;
                } else {
                    return 0;
                }
            });
            Tomahawk.addAlbumTrackResults({
                qid: qid,
                artist: artist,
                album: album,
                results: searchResults
            });
        });
    },

    collection: function () {
        // TODO: trackcount
        return {
            prettyname: "Beets",
            description: this.host,
            iconfile: 'beets-icon.png'
        };
    }
});

Tomahawk.resolver.instance = BeetsResolver;
