/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 * (c) 2011 leo franchi <lfranchi@kde.org>
 */
var DilandauResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Dilandau',
        weight: 90,
        timeout: 5,
        strictMatch: true
    },

    handleResponse: function(qid, artist, album, title) {
        var that = this;
        return function (xhr) {
            var matches = [];
            var xmlString = xhr.responseText;
            xmlString.replace(/<a class="button download_button" title="[^"]*"  href="([^"]*)"/g, function () {
                matches.push(Array.prototype.slice.call(arguments, 1, 2));
            });

            var matchesTitle = [];
            xmlString.replace(/<h2 class="title_song item" title="([^"]*)"/g, function () {
                matchesTitle.push(Array.prototype.slice.call(arguments, 1, 2));
            });

            var results = [];
            if (matches.length > 0 && matches.length == matchesTitle.length) {
                // walk through the results and store it in 'results'
                for (var i = 0; i < matches.length; i++) {
                    var link = matches[i];
                    var dTitle = matchesTitle[i];
                    var dTitleLower = dTitle.toString().toLowerCase();

                    if (!that.settings.strictMatch || (dTitleLower.indexOf(artist.toLowerCase()) !== -1 && dTitleLower.indexOf(title.toLowerCase()) !== -1)) {
                        var result = {};
                        result.artist = artist;
                        result.album = album;
                        result.track = title;

                        result.source = that.settings.name;
                        result.url = decodeURI(link);

                        result.mimetype = "audio/mp3";
                        result.bitrate = 128;
                        if (that.settings.strictMatch) result.score = 1.0;
                        else result.score = 0.5;

                        results.push(result);
                    }
                }
            }
            var return1 = {
                qid: qid,
                results: results
            };
            Tomahawk.addTrackResults( return1 );
       }
    },

    resolve: function (qid, artist, album, title) {
        // build query to Dilandau
        var url = "http://www.dilandau.eu/download_music/";
        var request = "";
        if (title !== "") request += title.replace(/ /g, '-');

        if (artist !== "") {
            if (title !== "") request += '-';
            request += artist.replace(/ /g, '-');
        }

        url += encodeURIComponent(request)

        url += "-1.html";

        // send request and parse it into javascript
        Tomahawk.asyncRequest(url, this.handleResponse(qid, artist, album, title));
    },
    
    search: function (qid, searchString) {
        var return1 = {
            qid: qid,
            results: new Array()
        };
        return return1;
    }
});

Tomahawk.resolver.instance = DilandauResolver;