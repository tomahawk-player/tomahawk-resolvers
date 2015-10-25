var Tomahawk = Tomahawk || {};
Tomahawk.collections = [];
Tomahawk.PluginManager = new (require('tomahawk/plugin-manager').default);

// install RSVP error handler for uncaught(!) errors
RSVP.on('error', function (reason) {
    var resolverName = "";
    if (window.resolverInstance) {
        resolverName = window.resolverInstance.getSettings().name + " - ";
    }
    if (reason) {
        console.error(resolverName + 'Uncaught error:' + JSON.stringify(reason));
        if(reason.message) {
            console.error(resolverName + 'Uncaught error:', reason.message, reason.stack);
        }
    } else {
        console.error(resolverName + 'Uncaught error: error thrown from RSVP but it was empty');
    }
});

// ATTENTION: Do we still need the following?!

// Legacy compability for 0.8 and before
Tomahawk.reportCapabilities = function (capabilities) {
    if (capabilities & TomahawkResolverCapability.Browsable) {
        Tomahawk.PluginManager.registerPlugin("collection", Tomahawk.resolver.instance);
    }

    Tomahawk.nativeReportCapabilities(capabilities);
};

Tomahawk.addArtistResults = Tomahawk.addAlbumResults = Tomahawk.addAlbumTrackResults
    = function (result) {
    Tomahawk.PluginManager.resolve[result.qid](result);
    delete Tomahawk.PluginManager.resolve[result.qid];
};

Tomahawk.addTrackResults = function (result) {
    Tomahawk.PluginManager.resolve[result.qid](result.results);
    delete Tomahawk.PluginManager.resolve[result.qid];
};

Tomahawk.reportStreamUrl = function (qid, streamUrl, headers) {
    Tomahawk.PluginManager.resolve[qid]({
        url: streamUrl,
        headers: headers
    });
    delete Tomahawk.PluginManager.resolve[qid];
};

Tomahawk.addUrlResult = function (url, result) {
    /* Merge the whole mess into one consistent result which is independent of type
     var cleanResult = {
     type: result.type,
     guid: result.guid,
     info: result.info,
     creator: result.creator,
     linkUrl: result.url
     };
     if (cleanResult.type == "track") {
     cleanResult.track = result.title;
     cleanResult.artist = result.artist;
     } else if (cleanResult.type == "artist") {
     cleanResult.artist = result.name;
     } else if (cleanResult.type == "album") {
     cleanResult.album = result.name;
     cleanResult.artist = result.artist;
     } else if (cleanResult.type == "playlist") {
     cleanResult.title = result.title;
     } else if (cleanResult.type == "xspf-url") {
     cleanResult.url = result.url;
     }
     if (result.tracks) {
     cleanResult.tracks = [];
     var i;
     for (i=0;i<result.tracks.length;i++) {
     var cleanTrack = {
     track: result.tracks[i].title,
     artist: result.tracks[i].artist
     };
     cleanResult.push(cleanTrack)
     }
     Tomahawk.PluginManager.resolve[url](cleanResult);
     */
    Tomahawk.PluginManager.resolve[url](result);
    delete Tomahawk.PluginManager.resolve[url];
};
