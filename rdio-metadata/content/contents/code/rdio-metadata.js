/*
 *   Copyright 2013,      Uwe L. Korn <uwelk@xhochy.com>
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

var RdioMetadataResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'rdio Metadata',
        icon: 'rdio-metadata.png',
        weight: 0, // We cannot resolve, so use minimum weight
        timeout: 15
    },

	init: function() {
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
	},


    resolve: function (qid, artist, album, title) {
        Tomahawk.addTrackResults({ results: [], qid: qid });
    },

	search: function (qid, searchString) {
        Tomahawk.addTrackResults({ results: [], qid: qid });
	},

    canParseUrl: function (url, type) {
        switch (type) {
        case TomahawkUrlType.Album:
            return /https?:\/\/(www\.)?rdio.com\/artist\/([^\/]*)\/album\/([^\/]*)\/?$/.test(url);
        case TomahawkUrlType.Artist:
            return /https?:\/\/(www\.)?rdio.com\/artist\/([^\/]*)\/?$/.test(url);
        case TomahawkUrlType.Playlist:
            return /https?:\/\/(www\.)?rdio.com\/people\/([^\/]*)\/playlists\/(\d+)\//.test(url);
        case TomahawkUrlType.Track:
            return /https?:\/\/(www\.)?rdio.com\/artist\/([^\/]*)\/album\/([^\/]*)\/track\/([^\/]*)\/?$/.test(url);
        // case TomahawkUrlType.Any:
        default:
            return /https?:\/\/(www\.)?rdio.com\/([^\/]*\/|)/.test(url);
        }
    },

    encodeOAuthComponent: function (url) {
        var encoded = encodeURIComponent(url);
        encoded = encoded.replace(/\!/g, "%21").replace(/\'/g, "%27");
        encoded = encoded.replace(/\(/g, "%28").replace(/\)/g, "%29");
        return encoded.replace(/\*/g, "%2A");
    },

    lookupUrl: function (url) {
        var that = this;
        var fetchUrl = 'http://api.rdio.com/1/'
        var query = 'extras=tracks&method=getObjectFromUrl';
        query += '&oauth_consumer_key=gk8zmyzj5xztt8aj48csaart';
        var nonce = '';
        for (i = 0; i < 8; i++) nonce += parseInt(Math.random() * 10).toString();
        query += '&oauth_nonce=' + nonce;
        query += '&oauth_signature_method=' + this.encodeOAuthComponent('HMAC-SHA1');
        query += '&oauth_timestamp=' + Math.round((new Date()).getTime() / 1000);;
        query += '&oauth_version=1.0';
        query += '&url=' + this.encodeOAuthComponent(url);
        var toSign = 'POST&' + this.encodeOAuthComponent(fetchUrl) + '&' + this.encodeOAuthComponent(query);
        var signature = CryptoJS.HmacSHA1(toSign, 'yt35kakDyW&').toString(CryptoJS.enc.Base64);
        query += '&oauth_signature=' + this.encodeOAuthComponent(signature);
        Tomahawk.log(fetchUrl)
        Tomahawk.log(query)
        Tomahawk.asyncRequest(fetchUrl, function (xhr) {
            var res = JSON.parse(xhr.responseText);
            if (res.status == 'ok') {
                if (res.result.type == 'p') {
                    var result = {
                        type: "playlist",
                        title: res.result.name,
                        guid: "rdio-playlist-" + res.result.key,
                        info: "A playlist by " + res.result.owner + " on rdio.",
                        creator: res.result.owner,
                        url: res.result.shortUrl,
                        tracks: []
                    };
                    result.tracks = res.result.tracks.map(function (item) { return { type: "track", title: item.name, artist: item.artist }; });
                    Tomahawk.addUrlResult(url, result);
                } else if (res.result.type == 't') {
                    Tomahawk.addUrlResult(url, {
                        type: "track",
                        title: res.result.name,
                        artist: res.result.artist,
                    });
                } else if (res.result.type == 'a') {
                    Tomahawk.addUrlResult(url, {
                        type: "album",
                        name: res.result.name,
                        artist: res.result.artist,
                    });
                } else if (res.result.type == 'r') {
                    Tomahawk.addUrlResult(url, {
                        type: "artist",
                        name: res.result.name,
                    });
                }
            }
        }, {"Content-type": "application/x-www-form-urlencoded"}, {
            method: 'post',
            data: query
        });
    }
});

Tomahawk.resolver.instance = RdioMetadataResolver;

