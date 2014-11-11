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

var YoutubeUrllookup = Tomahawk.extend(TomahawkResolver, {
    init: function (callback) {
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        if (callback){
            callback(null);
        }
    },

    canParseUrl: function (url, type){
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
                return (/https?:\/\/(www\.)?youtube.com\/watch\?v=.*/).test(url);
        }
    },

    lookupUrl: function (url){
        var begin = url.indexOf("?v=") + 3;
        var end = url.indexOf("&", begin);
        var videoId = url.substring(begin, end);
        var query = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + videoId + "&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA";
        Tomahawk.log("Query URL for " + url + " --> " + query);
        Tomahawk.addUrlResult(url, {});
    }
});

Tomahawk.resolver.instance = YoutubeUrllookup
