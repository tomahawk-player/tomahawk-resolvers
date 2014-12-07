/*
* Copyright (C) 2014 Thierry Göckel <thierry@strayrayday.lu>
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program. If not, see <http://www.gnu.org/licenses/>.
*
**/

var YoutubeMetadataResolver = Tomahawk.extend(TomahawkResolver, {

    settings: {
        name: 'YouTube Metadata',
        icon: 'youtube-icon.png',
        weight: 0, // not a resolver
        timeout: 15
    },

    init: function (callback) {
        String.prototype.regexIndexOf = function (regex, startpos) {
            var indexOf = this.substring(startpos || 0).search(regex);
            return (indexOf >= 0) ? (indexOf + (startpos || 0 )) : indexOf;
        };
        String.prototype.capitalise = function () {
            return this.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
        };
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        if (callback){
            callback(null);
        }
    },

    cleanupAndParseTrack: function(title) {
        var result = {};
        // For the ease of parsing, remove these
        if (title.regexIndexOf(/(?:[([](?=(official))).*?(?:[)\]])|(?:(official|video)).*?(?:(video))/i, 0) !== -1){
            title = title.replace(/(?:[([](?=(official|video))).*?(?:[)\]])/gi, "");
            title = title.replace(/(official|video(?:([!:-])))/gi, "");
            result.isOfficial = 1;
        }
        result.query = title;
        // Sometimes users separate titles with quotes :
        // eg, "\"Young Forever\" Jay Z | Mr. Hudson (OFFICIAL VIDEO)"
        // this will parse out the that title
        var inQuote = title.match(/([""'])(?:(?=(\\?))\2.).*\1/g);
        if (inQuote && inQuote !== undefined){
            result.track = inQuote[0].substr(1, inQuote[0].length - 2);
            title = title.replace(inQuote[0], '');
            result.fromQuote = result.track;
            result.parsed = this.parseCleanTrack(title);
            if (result.parsed){
                result.parsed.track = result.track;
                return result.parsed;
            }
        } else {
            result.parsed = this.parseCleanTrack(title);
            if (result.parsed){
                return result.parsed;
            }
        }
        return result;
    },

    parseCleanTrack: function(track) {
        var result = {};
        result.query = track;
        result.query.replace(/.*?(?=([-¿¿:|]\s))/g, function (param) {
            if (param.trim() !== ""){
                if (result.artist === undefined){
                    result.artist = param;
                } else {
                    if (result.track === undefined){
                        result.track = param;
                    }
                }
            }
        });
        result.query.replace(/(?=([-¿¿:|]\s)).*/g, function (param) {
            if (param.trim() !== ""){
                if (param.regexIndexOf(/([-¿¿|:]\s)/g, 0) === 0){
                    if (result.track === undefined){
                        result.track = param.replace(/([-¿¿|:]\s)/g, "");
                    }
                } else {
                    if (result.artist === undefined){
                        result.artist = param;
                    }
                    result.track = result.replace(/([-¿¿|:]\s)/g, "");
                }
            }
        });
        if (result.track !== undefined && result.artist !== undefined){
            // Now, lets move 'featuring' to track title, where it belongs
            var ftmatch = result.artist.match( /(?:(\s)(?=(feat.|feat|ft.|ft|featuring)(?=(\s)))).*/gi );
            if (ftmatch){
                result.artist = result.artist.replace(ftmatch, "");
                result.track += " " + ftmatch;
            }
            // Trim
            result.track = result.track.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');
            result.artist = result.artist.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');
            delete result.query;
            return result;
        }
        return null;
    },

    extractPlaylistItems: function (url, query, candidates){
        var that = this;
        Tomahawk.asyncRequest(query, function (xhr) {
            var response = JSON.parse(xhr.responseText);
            if (response.hasOwnProperty("items") && response.items.length !== 0){
                var totalResults = response.items.length;
                for (var i = 0; i < totalResults; i++){
                    if (!response.items[i].hasOwnProperty("snippet") || !response.items[i].snippet.hasOwnProperty("title")){
                        continue;
                    }
                    var title = response.items[i].snippet.title;
                    if (title.toLowerCase().match(/\(full .*?\)/g)){
                        continue;
                    }
                    var parsedTrack = that.cleanupAndParseTrack(title);
                    if (parsedTrack && parsedTrack.hasOwnProperty("artist") && parsedTrack.hasOwnProperty("track")){
                        parsedTrack.position = response.items[i].snippet.position;
                        candidates.push(parsedTrack);
                    }
                }
                if (response.hasOwnProperty("nextPageToken")){
                    if (query.indexOf("&pageToken") !== -1){
                        query = query.substring(0, query.indexOf("&pageToken=")) + "&pageToken=" + response.nextPageToken;
                    } else {
                        query = query + "&pageToken=" + response.nextPageToken;
                    }
                    that.extractPlaylistItems(url, query, candidates);
                } else {
                    that.verify(url, candidates);
                }
            } else {
                Tomahawk.addUrlResult(url, {});
            }
        });
    },

    verify: function (url, candidates){
        var stop = candidates.length;
        var query = "";
        var result = {};
        result.tracks = [];
        candidates.forEach(function (candidate){
            query = "http://ws.audioscrobbler.com/2.0/?method=track.getCorrection&api_key=b14d61bf2f7968731eb686c7b4a1516e&format=json&artist=" + encodeURIComponent(candidate.artist) + "&track=" + encodeURIComponent(candidate.track);
            Tomahawk.asyncRequest(query, function (xhr) {
                var response = JSON.parse(xhr.responseText);
                var track = {};
                if (response.hasOwnProperty("corrections") && response.corrections.hasOwnProperty("correction") && response.corrections.correction.hasOwnProperty("track") && response.corrections.correction.track.hasOwnProperty("artist")){
                    track.type = "track";
                    track.artist = response.corrections.correction.track.artist.name;
                    track.title = response.corrections.correction.track.name;
                    track.position = candidate.position;
                    result.tracks.push(track);
                } else if (response.hasOwnProperty("corrections")){
                    track.type = "track";
                    track.title = candidate.track.capitalise();
                    track.artist = candidate.artist.capitalise();
                    track.position = candidate.position;
                    result.tracks.push(track);
                }
                stop--;
                if (stop === 0){
                    if (result.tracks.length !== 0){
                        result.tracks.sort(function(a,b){return (a.position > b.position) ? 1 : ((b.position > a.position) ? -1 : 0);});
                        result.tracks.forEach(function(v){ delete v.position});
                        result.type = "playlist";
                        var begin = url.indexOf("&list=") + 6;
                        var playlistId = (url.indexOf("&", begin) !== -1) ? url.substring(begin, Math.min(url.length, url.indexOf("&", begin))) : (url.indexOf("#", begin) !== -1) ? url.substring(begin, Math.min(url.length, url.indexOf("#", begin))) : url.substring(begin, url.length);
                        result.guid = "youtube-playlist-" + playlistId;
                        result.title = "YouTube Mix - " + result.tracks[0].artist + " - " + result.tracks[0].title;
                        Tomahawk.addUrlResult(url, result);
                    } else {
                        Tomahawk.addUrlResult(url, {});
                    }
                }
            });
        });
    },

    canParseUrl: function (url, type){
        if (!(/https?:\/\/(www\.)?youtube.com\/watch\?v=.*/).test(url))
	    return false;

        switch (type){
            case TomahawkUrlType.Album:
                return false;
            case TomahawkUrlType.Artist:
                return false;
            case TomahawkUrlType.Playlist:
                return true;
            case TomahawkUrlType.Track:
                return true;
            default:
                return true;
        }
    },

    lookupUrl: function (url){
        var query = "";
        var result = {};
        var that = this;
        var begin = -1;
        if (url.indexOf("&list=") === -1){
            begin = url.indexOf("?v=") + 3;
            var videoId = (url.indexOf("&", begin) !== -1) ? url.substring(begin, Math.min(url.length, url.indexOf("&", begin))): url.substring(begin, url.length);
            query = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + videoId + "&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA";
            Tomahawk.asyncRequest(query, function (xhr) {
                var response = JSON.parse(xhr.responseText);
                if (response.hasOwnProperty("items") && response.items.length !== 0){
                    var title = response.items[0].snippet.title;
                    var parsedTrack = that.cleanupAndParseTrack(title);
                    if (parsedTrack && parsedTrack.hasOwnProperty("artist") && parsedTrack.hasOwnProperty("track")){
                        query = "http://ws.audioscrobbler.com/2.0/?method=track.getCorrection&api_key=b14d61bf2f7968731eb686c7b4a1516e&format=json&limit=5&artist=" + encodeURIComponent(parsedTrack.artist) + "&track=" + encodeURIComponent(parsedTrack.track);
                        Tomahawk.asyncRequest(query, function (xhr2) {
                            var response2 = JSON.parse(xhr2.responseText);
                            if (response2.hasOwnProperty("corrections")){
                                if (response2.corrections.hasOwnProperty("correction") && response2.corrections.correction.hasOwnProperty("track") && response2.corrections.correction.track.hasOwnProperty("artist")){
                                    result.type = "track";
                                    result.artist = response2.corrections.correction.track.artist.name;
                                    result.title = response2.corrections.correction.track.name;
                                } else {
                                    result.type = "track";
                                    result.artist = parsedTrack.artist.capitalise();
                                    result.title = parsedTrack.track.capitalise();
                                }
                            }
                            Tomahawk.addUrlResult(url, result);
                        });
                    } else {
                        Tomahawk.addUrlResult(url, result);
                    }
                }
            });
        } else {
            begin = url.indexOf("&list=") + 6;
            var playlistId = (url.indexOf("&", begin) !== -1) ? url.substring(begin, Math.min(url.length, url.indexOf("&", begin))) : (url.indexOf("#", begin) !== -1) ? url.substring(begin, Math.min(url.length, url.indexOf("#", begin))) : url.substring(begin, url.length);
           query = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=" + playlistId + "&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&maxResults=50";
            this.extractPlaylistItems(url, query, []);
        }
    }
});

Tomahawk.resolver.instance = YoutubeMetadataResolver;
