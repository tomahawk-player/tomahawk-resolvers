/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 * (c) 2011 leo franchi <lfranchi@kde.org>
 * (c) 2012 thierry göckel <thierry@strayrayday.lu>
 */
var DilandauResolver = Tomahawk.extend(TomahawkResolver, {

	settings: {
		name: 'Dilandau',
		icon: 'dilandau-icon.png',
		weight: 90,
		timeout: 10
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
			var results = [];
			var empty = {
				qid: qid,
				results: []
			};
			if (matches.length > 0 && matches.length === matchesTitle.length) {
				var stop = matches.length;
				for (var i = 0; i < matches.length; i++) {
					var url = matches[i][0];
					var dTitle = matchesTitle[i];
					var dTitleLower = dTitle.toString().toLowerCase();
					if (dTitleLower.indexOf(artist.toLowerCase()) === -1 || dTitleLower.indexOf(title.toLowerCase()) === -1) {
						stop = stop - 1;
						continue;
					}
					else {
						(function(qid, url) {
							var http = new XMLHttpRequest();
							http.open('HEAD', url, true);
							http.onreadystatechange = function() {
								if (http.readyState === 4){
									if (http.status === 200 && http.getResponseHeader("Content-Type") !== null && (http.getResponseHeader("Content-Type").indexOf("audio") !== -1 || http.getResponseHeader("Content-Type").indexOf("video") !== -1 )){
										var result = {};
										result.artist = artist;
										result.track = title;
										result.source = that.settings.name;
										result.url = url;
										result.mimetype = "audio/mpeg";
										result.bitrate = 128;
										result.score = 0.9;
										results.push(result);
										stop = stop - 1;
										if (stop === 0){
											var return1 = {
												qid: qid,
												results: [results[0]]
											};
											Tomahawk.addTrackResults(return1);
										}
									}
									else {
										stop = stop - 1;
									}
								}
							};
							http.send(null);
						})(qid, url);
					}
				}
				if (stop === 0){
					Tomahawk.addTrackResults(empty);
				}
			}
			else {
				Tomahawk.addTrackResults(empty);
			}
		};
	},


	resolve: function (qid, artist, album, title) {
		// build query to Dilandau
		var url = "http://www.dilandau.eu/download_music/";
		var request = "";
		if (title !== ""){
			request += title.replace(/ /g, '-');
		}

		if (artist !== "") {
			if (title !== ""){
				request += '-';
			}
			request += artist.replace(/ /g, '-');
		}

		url += encodeURIComponent(request);

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
