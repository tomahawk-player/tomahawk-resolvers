/* http://bandcamp.com resolver for Tomahawk.
 * This one use API used by Bandcamp's Android App
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 */

var BandcampResolver = Tomahawk.extend( Tomahawk.Resolver, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'bandcampm',
        weight: 90,
        icon: '../images/icon.png',
        timeout: 15
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.band_name,
            album:      entry.album_name,
            track:      entry.name,
            title:      entry.name,
            hint:        'bandcampm://track/' + entry.band_id + '/' + entry.id,
            bitrate:    128,
            type:       "track"
        };
    },

    getStreamUrl: function(params) {
        if (params.url.indexOf('http') == 0)
        {
            return {url:params.url};
        }
        var that = this;
        var parsed = params.url.match(/^bandcampm:\/\/([a-z]+)\/(\d+)\/(\d+)$/);
        var band_id = parsed[2];
        var id      = parsed[3];
        return Tomahawk.get('https://bandcamp.com/api/mobile/15/tralbum_details?tralbum_type=t&band_id='+band_id+'&tralbum_id='+id).then(function(result){
            var url = result.tracks[0].streaming_url['mp3-128'];
            return {url:url};
        });
    },

    search: function (params) {
        var that = this;

        return Tomahawk.get('https://bandcamp.com/api/nusearch/2/autocomplete?q=' + params.query).then(function(result){
            var trackPromises = result.results.filter(function(e) {
                return e.type == 't'; //t stands for track, b - band, a - album
            }).map(that._convertTrack, that).splice(0,3).map(function(track){
                //We don't know if track streamable during search, we limit to
                //3 top results as otherwise we'll start getting 503s
                var parsed = track.hint.match(/^bandcampm:\/\/([a-z]+)\/(\d+)\/(\d+)$/);
                var band_id = parsed[2];
                var id      = parsed[3];
                return Tomahawk.get('https://bandcamp.com/api/mobile/15/tralbum_details?tralbum_type=t&band_id='+band_id+'&tralbum_id='+id).then(function(result){
                    if(result.tracks.length > 0) {
                        track.url = result.tracks[0].streaming_url['mp3-128'];
                        track.duration = parseInt(result.tracks[0].duration);//Its actually a float but we don't need fractions of seconds
                    }
                    return track;
                });
            });
            return Promise.all(trackPromises);
        });
    },

    resolve: function (params) {
        var query = params.track;//search we're using searches matches in a single field
        return this.search({query:query});
    }
});

Tomahawk.resolver.instance = BandcampResolver;
