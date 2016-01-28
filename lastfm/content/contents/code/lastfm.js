/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011-2015, Thierry Göckel <thierry@strayrayday.lu>
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

var LastfmResolver = Tomahawk.extend(TomahawkResolver, {

    arr: [],

    settings: {
        name: 'Last.fm',
        icon: 'lastfm-icon.png',
        weight: 85,
        timeout: 5
    },

    init: function (){
        "use strict";

        if(Tomahawk.reportCapabilities && window.TomahawkResolverCapability && window.TomahawkResolverCapability.UrlLookup) {
            Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        }
    },

    canParseUrl: function (url, type){
        "use strict";

        var domainRegex = /http:\/\/(cn|www)\.last(\.fm|fm\.(de|es|fr|it|jp|pl|com\.br|ru|se|com\.tr))\/music\//;

        if (!(domainRegex).test(url)){
            return false;
        }
        this.arr = url.replace(domainRegex, "").split("\/");

        switch (type){
            case TomahawkUrlType.Album:
                return this.arr.length >= 2;
            case TomahawkUrlType.Artist:
                return this.arr.length >= 1;
            case TomahawkUrlType.Playlist:
                return false;
            case TomahawkUrlType.Track:
                return this.arr.length === 3;
            default:
                return true;
        }
    },

    lookupUrl: function (url){
        "use strict";

        var result = {};
        if (this.arr.length >= 1){
            result.type = "artist";
            result.name = decodeURIComponent(this.arr[0]).replace(/\+/g, " ");
            if (result.name.indexOf("?") !== -1){
                result.name = result.name.substring(0, result.name.indexOf("?"));
            }
            if (this.arr.length >= 2){
                result.type = "album";
                result.artist = result.name;
                result.name = decodeURIComponent(this.arr[1]).replace(/\+/g, " ");
                if (result.name.indexOf("?") !== -1){
                    result.name = result.name.substring(0, result.name.indexOf("?"));
                }
                if (this.arr.length === 3){
                    result.type = "track";
                    result.title = decodeURIComponent(this.arr[2]).replace(/\+/g, " ");
                    if (result.title.indexOf("?") !== -1){
                        result.title = result.title.substring(0, result.title.indexOf("?"));
                    }
                    delete result.name;
                }
            }
        }
        Tomahawk.addUrlResult(url, result);
    },

    parseSongResponse: function (qid, responseString) {
        "use strict";

        var results = [];
        if (responseString !== undefined && responseString.track !== undefined && responseString.track.freedownload) {
            var result = {};
            result.artist = responseString.track.artist.name;
            result.track = responseString.track.name;
            if (responseString.track.album !== undefined) {
                result.album = responseString.track.album.title;
            } else {
                result.album = "";
            }
            if (responseString.track.year !== undefined) {
                result.year = responseString.track.year;
            }
            if (responseString.track.url !== undefined) {
                result.linkUrl = responseString.track.url;
            }
            result.source = this.settings.name;
            result.url = responseString.track.freedownload;
            if (result.url.indexOf('http:') === 0) {
                result.url = result.url.replace(/http:/, 'https:');
            }

            result.mimetype = "audio/mpeg";
            result.bitrate = 128;
            result.duration = responseString.track.duration / 1000;
            result.score = 0.95;
            results.push(result);
        }

        return results;
    },
    resolve: function (params) {
        // disable until we found a new api to useful
        return [];

        "use strict";

        var artist = params.artist;
        var album = params.album;
        var title = params.track;

        artist = encodeURIComponent(artist).replace(/\%20/g, '+').trim();
        var track = encodeURIComponent(title).replace(/\%20/g, '+').trim();
        var lastfmUrl = "https://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=3ded6e3f4bfc780abecea04808abdd70&format=json&autocorrect=1&artist=" + artist + "&track=" + track;
        var that = this;
        return Tomahawk.get(lastfmUrl).then(that.parseSongResponse);
    },
    search: function (qid, searchString) {
        "use strict";

        // Not yet possible, sorry
        return [];
    }
});

Tomahawk.resolver.instance = LastfmResolver;
