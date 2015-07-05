/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011, lasconic <lasconic@gmail.com>
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

var JamendoResolver = Tomahawk.extend(TomahawkResolver, {

    settings: {
        name: 'Jamendo',
        icon: 'jamendo-icon.png',
        weight: 75,
        timeout: 5
    },

    handleResponse: function (qid, xhr) {
        // parse xml
        var domParser = new DOMParser();
        var xmlDoc = domParser.parseFromString(xhr.responseText, "text/xml");

        var results = [];
        var r = xmlDoc.getElementsByTagName("data");
        // check the response
        if (r.length > 0 && r[0].childNodes.length > 0) {
            var links = xmlDoc.getElementsByTagName("track");

            // walk through the results and store it in 'results'
            for (var i = 0; i < links.length; i++) {
                var link = links[i];

                results.push({
                    artist: Tomahawk.valueForSubNode(link, "artist_name"),
                    album: Tomahawk.valueForSubNode(link, "album_name"),
                    track: Tomahawk.valueForSubNode(link, "name"),
                    //year : Tomahawk.valueForSubNode(link, "year"),
                    source: this.settings.name,
                    url: decodeURI(Tomahawk.valueForSubNode(link, "stream"))
                        .replace(/http:\/\//, 'https://'),
                    // jamendo also provide ogg ?
                    extension: "mp3",
                    //bitrate : Tomahawk.valueForSubNode(link, "bitrate")/1000,
                    duration: Tomahawk.valueForSubNode(link, "duration"),
                    score: 1.0
                });
            }
        }
        Tomahawk.addTrackResults({
            qid: qid,
            results: results
        });
    },

    resolve: function (qid, artist, album, title) {
        // build query to Jamendo
        var url = "https://api.jamendo.com/get2/id+name+duration+stream+album_name+artist_name/track/xml/track_album+album_artist/?";
        if (title !== "") {
            url += "name=" + encodeURIComponent(title) + "&";
        }

        if (artist !== "") {
            url += "artist_name=" + encodeURIComponent(artist) + "&";
        }

        if (album !== "") {
            url += "album_name=" + encodeURIComponent(album) + "&";
        }

        url += "n=20";

        var that = this;
        Tomahawk.asyncRequest(url, function (xhr) {
            that.handleResponse(qid, xhr);
        });
    },

    search: function (qid, searchString) {
        // build query to Jamendo
        var url = "https://api.jamendo.com/get2/id+name+duration+stream+album_name+artist_name/track/xml/track_album+album_artist/?";
        if (searchString !== "") {
            url += "searchquery=" + encodeURIComponent(searchString);
        }

        url += "&n=20";
        var that = this;
        Tomahawk.asyncRequest(url, function (xhr) {
            that.handleResponse(qid, xhr);
        });
    }
});

Tomahawk.resolver.instance = JamendoResolver;
