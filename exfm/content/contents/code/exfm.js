/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 * Copyright 2011, lasonic <lasconic@gmail.com>
 * Copyright 2013, Uwe L. Korn <uwelk@xhochy.com>
 *
 * Tomahawk is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Tomahawk is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

var ExfmResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Ex.fm',
        icon: 'exfm-icon.png',
        weight: 30,
        timeout: 5
    },

    cleanTitle: function (title, artist) {
        // If the title contains a newline character, strip them off and remove additional spacing
        var newTitle = "",
            stringArray = title.split("\n");
        title.split("\n").forEach(function (split) {
            newTitle += split.trim() + " ";
        });
        // Remove dash and quotation characters.
        newTitle = newTitle.replace("\u2013", "").replace("  ", " ").replace("\u201c", "").replace("\u201d", "");
        // If the artist is included in the song title, cut it
        if (newTitle.toLowerCase().indexOf(artist.toLowerCase() + " -") === 0) {
            newTitle = newTitle.slice(artist.length + 2).trim();
        } else if (newTitle.toLowerCase().indexOf(artist.toLowerCase() + "-") === 0) {
            newTitle = newTitle.slice(artist.length + 1).trim();
        } else if (newTitle.toLowerCase().indexOf(artist.toLowerCase()) === 0) {
            // FIXME: This might break results where the artist name is a substring of the song title.
            newTitle = newTitle.slice(artist.length).trim();
        }
        return newTitle;
    },

    resolve: function (qid, artist, album, title) {
        var that = this,
        // Build search query for ex.fm
            url = "https://ex.fm/api/v3/song/search/" + encodeURIComponent(title) + "?start=0&results=20&client_id=tomahawk";

        // send request and parse it into javascript
        Tomahawk.asyncRequest(url, function (xhr) {
            // parse json
            var response = JSON.parse(xhr.responseText),
                results = [];

            // check the response
            if (response.results > 0) {
                response.songs.forEach(function (song) {
                    if ((song.url.indexOf("http://api.soundcloud") === 0) || (song.url.indexOf("https://api.soundcloud") === 0)) { // unauthorised, use soundcloud resolver instead
                        return;
                    }

                    if (song.artist === null || song.title === null) {
                        // This track misses relevant information, so we are going to ignore it.
                        return;
                    }
                    var result = {},
                        dTitle = that.cleanTitle(song.title, song.artist),
                        dArtist = song.artist,
                        dAlbum = "";
                    if (song.album !== null) {
                        dAlbum = song.album;
                    }
                    if ((dTitle.toLowerCase().indexOf(title.toLowerCase()) !== -1 && dArtist.toLowerCase().indexOf(artist.toLowerCase()) !== -1) || (artist === "" && album === "")) {
                        result.artist = ((dArtist !== "") ? dArtist : artist);
                        result.album = ((dAlbum !== "") ? dAlbum : album);
                        result.track = ((dTitle !== "") ? dTitle : title);
                        result.source = that.settings.name;
                        result.url = song.url;
                        result.extension = "mp3";
                        result.score = 0.80;
                        results.push(result);
                    }
                });
            }

            Tomahawk.addTrackResults({qid: qid, results: results});
        });
    },

    search: function (qid, searchString) {
        this.settings.strictMatch = false;
        this.resolve(qid, "", "", searchString);
    }
});

Tomahawk.resolver.instance = ExfmResolver;
