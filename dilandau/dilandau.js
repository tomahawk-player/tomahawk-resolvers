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
	parseISODuration: function( duration ) 
	{
		  var splitDurationRegex_ = new RegExp(
		    '^(-)?P(?:(\\d+)Y)?(?:(\\d+)M)?(?:(\\d+)D)?' +
		    '(T(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+(?:\\.\\d+)?)S)?)?$');
		  
		  Tomahawk.log(typeof(duration));
		  var parts = duration.match(splitDurationRegex_);
		  if (!parts) {
		    return null;
		  }
		
		  var timeEmpty = !(parts[6] || parts[7] || parts[8]);
		  var dateTimeEmpty = timeEmpty && !(parts[2] || parts[3] || parts[4]);
		  if (dateTimeEmpty || timeEmpty && parts[5]) {
		    return 0;
		  }
		
		  var negative = parts[1];
		  var years = parseInt(parts[2], 10) || 0;
		  var months = parseInt(parts[3], 10) || 0;
		  var days = parseInt(parts[4], 10) || 0;
		  var hours = parseInt(parts[6], 10) || 0;
		  var minutes = parseInt(parts[7], 10) || 0;
		  var seconds = parseFloat(parts[8]) || 0;
		  return negative ? (-days * 24 * 3600 - hours * 3600 - minutes*60 -seconds) :
		                    (days * 24 * 3600 + hours * 3600 + minutes*60 + seconds);
		
	},
    handleResponse: function(qid, artist, album, title) {
        var that = this;
        return function (xhr) {
            var matches = [];
            var xmlString = xhr.responseText;
			xmlString.replace(/<a class="button tip download_button" title="[^"]*"  href="([^"]*)"/g, function() {
				matches.push(Array.prototype.slice.call(arguments,1,2));
			});
			
			var matchesTitle = [];
			xmlString.replace(/<h2 class="title_song" title="([^"]*)"/g, function() {
				matchesTitle.push(Array.prototype.slice.call(arguments,1,2));
			});
			
			//TODO duration are not yet accurate on dilandau
			//var matchesDuration = [];
			//xmlString.replace(/<meta itemprop="duration" content="([^"]*)"/g, function() {
			//	matchesDuration.push(Array.prototype.slice.call(arguments,1,2));
			//});

            var results = [];
            if (matches.length > 0 && matches.length == matchesTitle.length) {
                // walk through the results and store it in 'results'
                for (var i = 0; i < matches.length; i++) {
                    var link = matches[i];
                    var dTitle = matchesTitle[i];
                    var dTitleLower = dTitle.toString().toLowerCase();
                    
                   	var dDuration = 0;
		            //TODO Currently dilandau duration are not accurate.
		            //if(matchesDuration.length == matchesTitle.length) {
		            	//Tomahawk.log(matchesDuration[i]);
		            	//dDuration = this.parseISODuration(matchesDuration[i].toString());
		            //}
		            
                    if (!that.settings.strictMatch || (dTitleLower.indexOf(artist.toLowerCase()) !== -1 && dTitleLower.indexOf(title.toLowerCase()) !== -1)) {
                        var result = {};
                        result.artist = artist;
                        result.album = album;
                        result.track = title;
                        result.duration - dDuration;

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