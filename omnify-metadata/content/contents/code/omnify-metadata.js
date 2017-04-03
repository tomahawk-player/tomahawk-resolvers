/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2017, Enno Gottschalk <mrmaffen@googlemail.com>
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as
 *   published by the Free Software Foundation, version 3.
 *
 *   Tomahawk is distributed in the hope that it will be useful, but
 *   WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 *   Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var OmnifyMetadataResolver = Tomahawk.extend(Tomahawk.Resolver, {

    apiVersion: 0.9,

    settings: {
        name: 'Omnify Metadata',
        icon: 'icon.png',
        weight: 0, // We cannot resolve, so use minimum weight
        timeout: 15
    },

    canParseUrl: function (params) {
        var url = params.url;
        var type = params.type;

        switch (type) {
            case Tomahawk.UrlType.Album:
                return /^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n]+\/[^\/\n]+$/.test(url);
            case Tomahawk.UrlType.Artist:
                return /^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n][^\/\n_]+$/.test(url);
            case Tomahawk.UrlType.Track:
                return /^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n]+\/_\/[^\/\n]+$/.test(url);
            case Tomahawk.UrlType.Playlist:
                return /^https?:\/\/(www\.)?omni\.fyi\/people\/[^\/\n]+\/playlists\/[^\/\n]+$/.test(url);
            default:
                return false;
        }
    },

    lookupUrl: function (params) {
        var url = params.url;

        Tomahawk.log("lookupUrl: " + url);
        var urlParts =
            url.split('/').filter(function (item) {
                return item.length != 0;
            }).map(function (s) {
                return decodeURIComponent(s.replace(/\+/g, '%20'));
            });
        if (/^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n]+\/[^\/\n]+$/.test(url)) {
            Tomahawk.log("Found an album");
            // We have to deal with an Album
            return {
                type: Tomahawk.UrlType.Album,
                artist: urlParts[urlParts.length - 2],
                album: urlParts[urlParts.length - 1]
            };
        } else if (/^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n][^\/\n_]+$/.test(url)) {
            Tomahawk.log("Found an artist");
            // We have to deal with an Artist
            return {
                type: Tomahawk.UrlType.Artist,
                artist: urlParts[urlParts.length - 1]
            };
        } else if (/^https?:\/\/(www\.)?omni\.fyi\/music\/[^\/\n]+\/[^\/\n]+\/[^\/\n]+$/.test(
                url)) {
            Tomahawk.log("Found a track");
            // We have to deal with a Track
            return {
                type: Tomahawk.UrlType.Track,
                artist: urlParts[urlParts.length - 3],
                track: urlParts[urlParts.length - 1]
            };
        } else if (/^https?:\/\/(www\.)?omni\.fyi\/people\/[^\/\n]+\/playlists\/[^\/\n]+$/.test(
                url)) {
            // no playlist support just yet
        }
    }
});

Tomahawk.resolver.instance = OmnifyMetadataResolver;
