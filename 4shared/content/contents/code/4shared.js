/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011, lasconic <lasconic@gmail.com>
 *   Fixed in 2014 by Lorenz Hübschle-Schneider <lorenz@4z2.de>
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
        // Parse a file detail page
        var parseFileDetailPage = function (fileXhr) {

            var response = fileXhr.responseText,
                urlRegex = /<\!-- file: (https?:\/\/.*\.mp3) -->/gi,
                durationRegex = /options_[0-9]+\['duration'\] = '([0-9]+).0';/gi,
                bitrateRegex = /<b>Bit Rate:<\/b>\n\s+([0-9]+) kbps \|/gi,
                match;

            // Find mp3 URL
            match = urlRegex.exec(response);
            if (!match) {
                return;
            }
            var mp3Url = match[1];

            // Find track duration
            match = durationRegex.exec(response);
            var duration = match ? parseInt(match[1], 10) : null;

            // Try to find bit rate (only present on some files)
            match = bitrateRegex.exec(response);
            var bitrate = match ? parseInt(match[1], 10) : 128;

            var result = {
                artist: artist,
                album: album,
                track: title,
                source: that.settings.name,
                url: mp3Url,
                duration: duration,
                extension: 'mp3',
                bitrate: bitrate,
                score: 0.80
            };

            // return this result
            Tomahawk.addTrackResults({
                qid: qid,
                results: [result]
            });
        };

        // build query to 4shared
        var request = [title, artist].join(" ").trim();

        var url = "http://search.4shared.com/network/searchXml.jsp?q=";
        url += encodeURIComponent(request);
        url += "&searchExtention=mp3&sortType=1&sortOrder=1&searchmode=3";

        // send request and parse it into javascript
        var that = this;
        Tomahawk.asyncRequest(url, function (xhr) {
            // parse xml
            var domParser = new DOMParser(),
                xmlDoc = domParser.parseFromString(xhr.responseText, "text/xml"),
                results = xmlDoc.getElementsByTagName("result-files");

            // check the response
            if (results.length > 0 && results[0].childNodes.length > 0) {
                var links = xmlDoc.getElementsByTagName("file"),
                    link, fileDetailUrl;

                // walk through the results
                for (var i = 0; i < links.length; i++) {
                    link = links[i];
                    fileDetailUrl = link.getElementsByTagName("url")[0].textContent;
                    fileDetailUrl = decodeURI(fileDetailUrl);
                    // process this file detail page
                    Tomahawk.asyncRequest(fileDetailUrl, parseFileDetailPage);
                }
            }
        });
    },
    search: function (qid, searchString) {
        return {
            qid: qid,
            results: []
        };
    }
});

Tomahawk.resolver.instance = FSharedResolver;
