var StreamTestResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'Stream Test',
        icon: '../icon.png',
        weight: 10,
        timeout: 8
    },

    getConfigUi: function() {
        return {
            "widget": Tomahawk.readBase64( "config.ui" ),
            fields: [{
                name: "stream_url",
                widget: "url_edit",
                property: "text"
            }]
        };
    },

    init: function() {
        Tomahawk.PluginManager.registerPlugin("linkParser", this);
        Tomahawk.addCustomUrlHandler( 'streamtest', 'getStreamUrl', true );
    },

    resolve: function (artist, album, title) {
        return [{
            artist:     artist,
            album:      album,
            track:      title,
            title:      title,

            url:        'streamtest://track/' + encodeURIComponent(title),
            hint:       'streamtest://track/' + encodeURIComponent(title),
            checked:    true,
            bitrate:    64,
            type:       "track",
        }];
    },

    getStreamUrl: function(qid, url) {
        var config = this.getUserConfig();
        Tomahawk.reportStreamUrl(qid, config.stream_url);
    },

});

Tomahawk.resolver.instance = StreamTestResolver;
