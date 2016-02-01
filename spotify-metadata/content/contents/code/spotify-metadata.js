/*
 *   Copyright 2013, Uwe L. Korn <uwelk@xhochy.com>
 *   Copyright 2016, Enno Gottschalk <mrmaffen@googlemail.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 */

var SpotifyMetadataResolver = Tomahawk.extend(Tomahawk.Resolver, {

    apiVersion: 0.9,

    settings: {
        name: 'Spotify Metadata',
        icon: 'spotify-metadata.png',
        weight: 0, // We cannot resolve, so use minimum weight
        timeout: 15
    },

	init: function() {
        Tomahawk.PluginManager.registerPlugin("linkParser", this);
	},

    canParseUrl: function (params) {
        var url = params.url;
        var type = params.type;

        if (!url) {
            throw new Error("Provided url was empty or null!");
        }
        switch (type) {
            case TomahawkUrlType.Album:
                return /spotify:album:([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/album\/([^\/\?]+)/.test(url);
            case TomahawkUrlType.Artist:
                return /spotify:artist:([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/artist\/([^\/\?]+)/.test(url);
            case TomahawkUrlType.Playlist:
                return /spotify:user:([^:]+):playlist:([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/user\/([^\/]+)\/playlist\/([^\/\?]+)/.test(url);
            case TomahawkUrlType.Track:
                return /spotify:track:([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/track\/([^\/\?]+)/.test(url);
            // case TomahawkUrlType.Any:
            default:
                return /spotify:(album|artist|track):([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/(album|artist|track)\/([^\/\?]+)/.test(url)
                    || /spotify:user:([^:]+):playlist:([^:]+)/.test(url)
                    || /https?:\/\/(?:play|open)\.spotify\.[^\/]+\/user\/([^\/]+)\/playlist\/([^\/\?]+)/.test(url);
        }
    },

    lookupUrl: function (params) {
        var url = params.url;
        Tomahawk.log("lookupUrl: " + url);

        var match = url.match(/spotify[/:]+(album|artist|track)[/:]+([^/:?]+)/);
        if (match == null) {
            match
                = url.match(/https?:\/\/(?:play|open)\.spotify\.[^\/]+\/(album|artist|track)\/([^\/\?]+)/);
        }
        var playlistmatch = url.match(/spotify[/:]+user[/:]+([^/:]+)[/:]+playlist[/:]+([^/:?]+)/);
        if (playlistmatch == null) {
            playlistmatch
                = url.match(/https?:\/\/(?:play|open)\.spotify\.[^\/]+\/user\/([^\/]+)\/playlist\/([^\/\?]+)/);
        }
        if (match != null) {
            var query = 'https://ws.spotify.com/lookup/1/.json?uri=spotify:' + match[1] + ':'
                + match[2];
            Tomahawk.log("Found album/artist/track, calling " + query);
            return Tomahawk.get(query).then(function (response) {
                if (match[1] == "artist") {
                    Tomahawk.log("Reported found artist '" + response.artist.name + "'");
                    return {
                        type: Tomahawk.UrlType.Artist,
                        artist: response.artist.name
                    };
                } else if (match[1] == "album") {
                    Tomahawk.log("Reported found album '" + response.album.name + "' by '"
                        + response.album.artist + "'");
                    return {
                        type: Tomahawk.UrlType.Album,
                        album: response.album.name,
                        artist: response.album.artist
                    };
                } else if (match[1] == "track") {
                    var artist = response.track.artists.map(function (item) {
                        return item.name;
                    }).join(" & ");
                    Tomahawk.log("Reported found track '" + response.track.name + "' by '" + artist
                        + "'");
                    return {
                        type: Tomahawk.UrlType.Track,
                        track: response.track.name,
                        artist: artist
                    };
                }
            });
        } else if (playlistmatch != null) {
            var query = 'http://spotikea.tomahawk-player.org/browse/spotify:user:'
                + playlistmatch[1] + ':playlist:' + playlistmatch[2];
            Tomahawk.log("Found playlist, calling url: '" + query + "'");
            return Tomahawk.get(query).then(function (res) {
                var tracks = res.playlist.result.map(function (item) {
                    return {
                        type: Tomahawk.UrlType.Track,
                        track: item.title,
                        artist: item.artist
                    };
                });
                Tomahawk.log("Reported found playlist '" + res.playlist.name + "' containing "
                    + tracks.length + " tracks");
                return {
                    type: Tomahawk.UrlType.Playlist,
                    title: res.playlist.name,
                    guid: "spotify-playlist-" + url,
                    info: "A playlist on Spotify.",
                    creator: res.playlist.creator,
                    linkUrl: url,
                    tracks: tracks
                };
            });
        }
    }
});

Tomahawk.resolver.instance = SpotifyMetadataResolver;

