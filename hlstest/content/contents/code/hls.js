var HlsResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'HLS',
        icon: '../images/icon.png',
        weight: 90,
        timeout: 8
    },

    init: function() {
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
        Tomahawk.addCustomUrlHandler( 'hls', 'getStreamUrl', true );
    },

    resolve: function (artist, album, title) {
        return [{
            artist:     artist,
            album:      album,
            track:      title,
            title:      title,

            url:        'hls://track/' + encodeURIComponent(title),
            hint:       'hls://track/' + encodeURIComponent(title),
            checked:    true,
            bitrate:    64,
            type:       "track",
        }];
    },

    getStreamUrl: function(qid, url) {
        Tomahawk.reportStreamUrl(qid, "http://walterebert.com/playground/video/hls/sintel-trailer.m3u8");
    },

});

Tomahawk.resolver.instance = HlsResolver;
