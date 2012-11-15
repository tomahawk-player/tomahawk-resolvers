var LastfmResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Last.fm',
        icon: 'lastfm-icon.png',
        weight: 85,
        timeout: 5
    },
    parseSongResponse: function (qid, responseString) {
        var results = new Array();
        if (responseString != undefined && responseString.track != undefined && responseString.track.freedownload) {
            var result = new Object();
            result.artist = responseString.track.artist.name;
            result.track = responseString.track.name;
            if (responseString.track.album != undefined) {
                result.album = responseString.track.album.title;
            } else {
                result.album = "";
            }
            if (responseString.track.year != undefined) {
                result.year = responseString.track.year;
            }
            result.source = this.settings.name;
            result.url = responseString.track.freedownload;
            result.mimetype = "audio/mpeg";
            result.bitrate = 128;
            result.duration = responseString.track.duration / 1000;
            result.score = 0.95;
            results.push(result);
        }
        var return1 = {
            qid: qid,
            results: results
        };
        Tomahawk.addTrackResults(return1);
    },
    resolve: function (qid, artist, album, title) {
        artist = encodeURIComponent(artist).replace(/\%20/g, '\+').trim();
        track = encodeURIComponent(title).replace(/\%20/g, '\+').trim();
        var lastfmUrl = "http://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=3ded6e3f4bfc780abecea04808abdd70&format=json&autocorrect=1&artist=" + artist + "&track=" + track;
        var that = this;
        Tomahawk.asyncRequest(lastfmUrl, function(xhr) {
            that.parseSongResponse(qid, JSON.parse(xhr.responseText));
        });
    },
    search: function (qid, searchString) {
        // Not yet possible, sorry
        this.resolve(qid, "", "", "");
    }
});

Tomahawk.resolver.instance = LastfmResolver;
