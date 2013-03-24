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

var FSharedResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: '4shared',
        icon: '4shared-icon.png',
        weight: 50,
        timeout: 5
    },
    resolve: function (qid, artist, album, title) {
        var valueForSubNode = function (node, tag) {
                return node.getElementsByTagName(tag)[0].textContent;
            };

        // build query to 4shared
        var url = "http://search.4shared.com/network/searchXml.jsp?q=";
        var request = "";
        if (title !== "") request += title + " ";

        if (artist !== "") request += artist + " ";

        url += encodeURIComponent(request)

        url += "&searchExtention=mp3&sortType=1&sortOrder=1&searchmode=3";
        // send request and parse it into javascript
        var that = this;
        var xmlString = Tomahawk.asyncRequest(url, function(xhr) {
            // parse xml
            var domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(xhr.responseText, "text/xml");

            var results = new Array();
            var r = xmlDoc.getElementsByTagName("result-files");
            // check the response
            if (r.length > 0 && r[0].childNodes.length > 0) {
                var links = xmlDoc.getElementsByTagName("file");

                // walk through the results and store it in 'results'
                for (var i = 0; i < links.length; i++) {
                    var link = links[i];

                    var result = new Object();
                    result.artist = artist;
                    result.album = album;
                    result.track = title;
                    //result.year = valueForSubNode(link, "year");
                    result.source = that.settings.name;
                    result.url = decodeURI(valueForSubNode(link, "flash-preview-url"));

                    result.extension = "mp3";
                    //result.bitrate = valueForSubNode(link, "bitrate")/1000;
                    result.bitrate = 128;
                    //result.duration = valueForSubNode(link, "duration");
                    result.score = 0.80;
                    results.push(result);
                }
            }

            var return1 = {
                qid: qid,
                results: results
            };
            
            Tomahawk.addTrackResults(return1);
        });
    },
    search: function (qid, searchString) {
        var return1 = {
            qid: qid,
            results: new Array()
        };
        return return1;
    }
});

Tomahawk.resolver.instance = FSharedResolver;