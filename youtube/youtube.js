var YoutubeResolver = Tomahawk.extend(TomahawkResolver, {
	
	getConfigUi: function() {
		var uiData = Tomahawk.readBase64("config.ui");
		return {
			"widget": uiData,
			fields: [{
				name: "includeCovers",
				widget: "covers",
				property: "checked"
			}, {
				name: "includeRemixes",
				widget: "remixes",
				property: "checked"
			}, {
				name: "includeLive",
				widget: "live",
				property: "checked"
			}, {
				name: "qualityPreference",
				widget: "qualityDropdown",
				property: "currentIndex"
			}],
			images: [{
				"youtube.png" : Tomahawk.readBase64("youtube.png")
			}]
		};
	},

	newConfigSaved: function() {
		var userConfig = this.getUserConfig();
		if ((userConfig.includeCovers !== this.includeCovers) || (userConfig.includeRemixes !== this.includeRemixes) || (userConfig.includeLive !== this.includeLive) || (userConfig.qualityPreference !== this.qualityPreference)) {
			this.includeCovers = userConfig.includeCovers;
			this.includeRemixes = userConfig.includeRemixes;
			this.includeLive = userConfig.includeLive;
			this.qualityPreference = userConfig.qualityPreference;
			this.saveUserConfig();
		}
	},

	settings:
	{
		name: 'YouTube',
		icon: 'youtube-icon.png',
		weight: 70,
		timeout: 15
	},
	
	getTrack: function(trackTitle, origTitle) {
		if ((this.includeCovers === false || this.includeCovers === undefined) && trackTitle.search(/cover/i) !== -1 && origTitle.search(/cover/i) === -1){
			return null;
		}
		if ((this.includeRemixes === false || this.includeRemixes === undefined) && trackTitle.search(/(re)*mix/i) !== -1 && origTitle.search(/(re)*mix/i) === -1){
			return null;
		}
		if ((this.includeLive === false || this.includeLive === undefined) && trackTitle.search(/live/i) !== -1 && origTitle.search(/live/i) === -1){
			return null;
		}
		else {
			return trackTitle;
		}
	},
	
	getBitrate: function(urlString) {
		//http://www.h3xed.com/web-and-internet/youtube-audio-quality-bitrate-240p-360p-480p-720p-1080p
		// No need to get higher than hd720, as it only will eat bandwith and do nothing for sound quality
		var bitrate;
		
		if (urlString.indexOf("quality=hd720") !== -1 ){
			bitrate = 192;
		}
		else if (urlString.indexOf("quality=medium") !== -1){
			bitrate = 128;
		}
		else if (urlString.indexOf("quality=small") !== -1){
			bitrate = 96;
		}
		return bitrate;
	},

	init: function() {
		// Set userConfig here
		var userConfig = this.getUserConfig();
		if ( userConfig !== undefined && userConfig.qualityPreference !== undefined ){
			this.includeCovers = userConfig.includeCovers;
			this.includeRemixes = userConfig.includeRemixes;
			this.includeLive = userConfig.includeLive;
			this.qualityPreference = userConfig.qualityPreference;
		}
		else {
			this.includeCovers = false;
			this.includeRemixes = false;
			this.includeLive = false;
			this.qualityPreference = 1;
		}

		String.prototype.capitalize = function(){
			return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
		};
	},

	hasPreferedQuality: function(urlString) {
		if (this.qualityPreference === undefined){
			Tomahawk.log("ASSERT: quality undefined!");
			return true;
		}
		if (urlString.indexOf("quality="+this.getPreferedQuality()) !== -1 ){
			return true;
		}
		return false;
	},

	getPreferedQuality: function() {
		if (this.qualityPreference === undefined){
			return "hd720"
		}
		switch( this.qualityPreference ) {
			default:
			case 0 : return "hd720";
			case 1 : return "medium"
			case 2 : return "small";
		}
	},

	magicCleanup: function(clean) {
		return clean.replace(/[^A-Za-z0-9 ]|(feat|ft.|featuring|prod|produced|produced by)/g, "").replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ').toLowerCase();
	},

	parseVideoUrlFromYtPage: function(html) {
		var magic = "url_encoded_fmt_stream_map=";
		var magicLimit = "\\u0026";
		// Sometimes, 'magic' is not actually in the code (e.g. if video is blocked or sth), don't assume it always is
		if (html.indexOf(magic) === -1){
			return null;
		}
		var pos = html.indexOf(magic) + magic.length;
		html = html.slice(pos);

		var urls = html.slice(0, html.indexOf(magicLimit));

		urls = unescape(urls);
		urls = urls.split(",");

		var urlsArray = [];
		for (i = 0; i < urls.length - 1; i++) {
			// decodeUri and replace itag, url,  ;codec=blabla" as well as the sig, currently resides in the fallback url 
			var subUrl = decodeURIComponent( urls[i]).replace(/\itag=(.[0-9]?&url=)/g, "").replace(/\;(.*?)"&/g, "&").replace("sig", "signature");
			// Append quality=large if hd720 isnt found? Need to check sound difference
			if (subUrl.indexOf("quality=hd720") !== -1 || subUrl.indexOf("quality=medium") !== -1 || subUrl.indexOf("quality=small") !== -1) {
				urlsArray.push(subUrl);
			}
		}

		var finalUrl;

		if (this.qualityPreference === undefined) {
			// This shouldnt happen really, but sometimes do?!
			// One way of throwing an "assert" :p
			//this.qualityPreference = 0;
			Tomahawk.log("Assert: Failed to set qualitypreference in init, resetting to " + this.qualityPreference);
		}

		for (i = 0; i < urlsArray.length; i++) {
			if (this.hasPreferedQuality(urlsArray[i])) {
				finalUrl = urlsArray[i];
			}
		}

		if (finalUrl === undefined) {
			finalUrl = urlsArray[0];
		}

		return finalUrl;
	},

	resolve: function(qid, artist, album, title) {
		if (artist !== "") {
			query = encodeURIComponent(artist) + "%20";
		}

		if (title !== "") {
			query += encodeURIComponent(title);
		}

		var limit = 10;
		var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q=" + query + "&v=2&alt=jsonc&safeSearch=none&max-results=" + limit;
		apiQuery = apiQuery.replace(/\%20/g, '\+');
		var that = this;
		var empty = {
			results: [],
			qid: qid
		};

		Tomahawk.asyncRequest(apiQuery, function(xhr) {
			var results = [];
			var resp = JSON.parse(xhr.responseText);

			if (resp.data.totalItems !== 0) {
				var stop = Math.min(limit, resp.data.totalItems);
				for (i = 0; i < Math.min(limit, resp.data.totalItems); i++) {
					if (resp.data.items[i] === undefined) {
						stop = stop - 1;
						continue;
					}

					var responseItem = resp.data.items[i];

					if (responseItem.duration === undefined) {
						stop = stop - 1;
						continue;
					}
					// ContentRating, eg. User needs to verify age or similar that requires login
					if (responseItem.contentRating !== undefined ) {
						stop = stop - 1;
						continue;
					}

					var responseTitle = responseItem.title.toLowerCase();

					// Check whether the artist and title (if set) are in the returned title, discard otherwise
					if ( typeof responseTitle !== undefined && responseTitle.indexOf(artist.toLowerCase()) === -1 || (title !== "" && responseTitle.toLowerCase().indexOf(title.toLowerCase()) === -1)) {
						// Lets do a deeper check
						// Users tend to insert [ft. Artist] or **featuring Artist & someOther artist
						// Remove these
						var newTitle = that.magicCleanup(title);
						var newArtist = that.magicCleanup(artist);
						var newRespTitle = that.magicCleanup(responseTitle);

						if (newRespTitle !== undefined && newRespTitle.indexOf(newArtist) === -1 || (newTitle !== "" && newRespTitle.indexOf(newTitle) === -1)) {
							// Lets do it in reverse!
							if( newArtist.indexOf(newTitle) === -1 && newTitle.indexOf(newArtist) === -1) {
								stop = stop - 1;
								continue;
							}
						}
					}

					if (that.getTrack(responseTitle, title)) {
						var result = new Object();
						if (artist !== "") {
							result.artist = artist;
						}
						result.source = that.settings.name;
						result.mimetype = "video/h264";
						result.duration = responseItem.duration;
						result.score = 0.85;
						result.year = responseItem.uploaded.slice(0,4);
						result.track = title;
						result.linkUrl = responseItem.player['default'];

						if (that.qualityPreference === 0) {
							result.linkUrl = responseItem.player['default'] + "&hd=1";
						}

						var self = that;

						(function(i, qid, result) {
							Tomahawk.asyncRequest(responseItem.player['default'], function(xhr2) {
								result.url  = self.parseVideoUrlFromYtPage(xhr2.responseText);
								if ( typeof result.url !== 'undefined' && result.url !== null ) {
									// Get the expiration time, to be able to cache results in tomahawk
									if ( result.url.indexOf("expire=") !== -1 ){
										var regex = /expire=([^&#]*)/g;
										var match = regex.exec(result.url);
										if ( match[1] !== undefined ) {
											var expiresInMinutes = Math.floor( ( match[1] - (new Date).getTime()/1000 ) / 60 );
											if ( expiresInMinutes > 0 ) {
												result.expires = expiresInMinutes;
											}
										}
									}
									result.bitrate = self.getBitrate(result.url);
									result.id = i;
									results.push(result);
									stop = stop - 1;
									if (stop === 0) {
										var best = i + 1;
										for (var j = 0; j < results.length; j++) {
											if (results[j].id < best || self.hasPreferedQuality(results[j].url)) {
												best = results[j].id;
												var finalResult = results[j];
											}
										}
										delete finalResult.id;
										var resolveReturn = {
											results: [finalResult],
											qid: qid
										};
										Tomahawk.addTrackResults(resolveReturn);
									}
								}
								else {
									stop = stop - 1;
								}
							});
						})(i, qid, result);
						delete result;
					}
					else {
						stop = stop - 1;
					}
				}
				if (stop === 0) { // if no results had appropriate titles, return empty
					Tomahawk.addTrackResults(empty);
				}
			}
			else {
				Tomahawk.addTrackResults(empty);
			}
		});
	},

	search: function( qid, searchString ) {
		var limit = 20;
		var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q=" + encodeURIComponent(searchString) + "&v=2&alt=jsonc&quality="+this.getPreferedQuality()+"&max-results=" + limit;
		apiQuery = apiQuery.replace(/\%20/g, '\+');
		var that = this;
		var empty = {
			results: [],
			qid: qid
		};
		Tomahawk.asyncRequest(apiQuery, function(xhr) {
			var resp = JSON.parse(xhr.responseText);
			if (resp.data.totalItems !== 0){
				var results = [];
				var stop = Math.min(limit, resp.data.totalItems);
				for (i = 0; i < Math.min(limit, resp.data.totalItems); i++) {
					if (resp.data.items[i] === undefined){
						stop = stop - 1;
						continue;
					}

					if (resp.data.items[i].duration === undefined) {
						stop = stop -1;
						continue;
					}

					// Check whether the artist and title (if set) are in the returned title, discard otherwise
					if (resp.data.items[i].title === undefined) {
						stop = stop - 1;
						continue;
					}

					// ContentRating, eg. User needs to verify age or similar that requires login
					// May also indicate country restrictions
					// @todo: Check user geo? may be found in result url, &gcr=COUNTRY_SHORT_CODE
					//        Value to be catched is then contentRating.GEOCODE
					//        If contentRating is just 1, login is required
					if ( resp.data.items[i].contentRating !== undefined ) {
						stop = stop - 1;
						continue;
					}

					if (that.getTrack(resp.data.items[i].title, "")) {
						var result = new Object();
						result.source = that.settings.name;
						result.mimetype = "video/h264";
						result.duration = resp.data.items[i].duration;
						result.score = 0.85;
						result.year = resp.data.items[i].uploaded.slice(0,4);
						result.linkUrl = resp.data.items[i].player['default'];
						if (that.qualityPreference === 0) {
							result.linkUrl = resp.data.items[i].player['default'] + "&hd=1";
						}

						var track = resp.data.items[i].title;
						if (track.indexOf(" - ") !== -1) {
							result.track = track.slice(track.indexOf(" - ") + 3);
							result.artist = track.slice(0, track.indexOf(" - "));
						}
						else if (track.indexOf(" -") !== -1) {
							result.track = track.slice(track.indexOf(" -") + 2);
							result.artist = track.slice(0, track.indexOf(" -"));
						}
						else if (track.indexOf(": ") !== -1) {
							result.track = track.slice(track.indexOf(": ") + 2);
							result.artist = track.slice(0, track.indexOf(": "));
						}
						else if (track.indexOf("-") !== -1) {
							result.track = track.slice(track.indexOf("-") + 1);
							result.artist = track.slice(0, track.indexOf("-"));
						}
						else if (track.indexOf(":") !== -1) {
							result.track = track.slice(track.indexOf(":") + 1);
							result.artist = track.slice(0, track.indexOf(":"));
						}
						else {
							stop = stop - 1;
							continue;
						}

						(function(i, qid, result) {
							// True story:
							// 	This url could be used instead of parsing the yt html. However, if the content is restricted from beeing
							// 	played from other sites, it will fail. It could be a way to get results faster and do a "normal" lookup if 
							// 	response is status=fail&errorcode=150&reason=This+video+contains+content+from+Vevo
							// 	URL: http://www.youtube.com/get_video_info?&video_id= + resp.data.items[i]['id']
							// 	If it is used in future, magic needs to be
							// 		var magic = "&url_encoded_fmt_stream_map=";
							//  	var magicLimit = ",";
							// End of anecdote
							var xhr2 = new XMLHttpRequest();
							xhr2.open('GET', resp.data.items[i].player['default'], true);
							xhr2.onreadystatechange = function() {
								if (xhr2.readyState === 4){
									if (xhr2.status === 200) {
										result.url = that.parseVideoUrlFromYtPage(xhr2.responseText);
										var artist = encodeURIComponent(result.artist.capitalize());
										var url = "http://developer.echonest.com/api/v4/artist/extract?api_key=JRIHWEP6GPOER2QQ6&format=json&results=5&sort=hotttnesss-desc&text=" + artist;
										var self = that;
										Tomahawk.asyncRequest(url, function(xhr3) {
											var response = JSON.parse(xhr3.responseText).response;
											if (response && response.artists && response.artists.length > 0) {
												artist = response.artists[0].name;
												result.artist = artist;
												if (typeof result.url !== 'undefined' && result.url !== null && result.url.indexOf("http") === 0 && result.url.indexOf("</body>") === -1) {
													result.bitrate = that.getBitrate(result.url);
													result.id = i;
													results.push(result);
													stop = stop - 1;
												}
												else {
													stop = stop - 1;
												}
											}
											else {
												stop = stop - 1;
											}
											if (stop === 0) {
												function sortResults(a, b) {
													return a.id - b.id;
												}
												results = results.sort(sortResults);
												for (var j = 0; j < results.length; j++) {
													delete results[j].id;
												}
												var toReturn = {
													results: results,
													qid: qid
												};
												Tomahawk.addTrackResults(toReturn);
											}
										});
									}
									else {
										Tomahawk.log("Failed to do GET request to: " + url);
										Tomahawk.log("Error: " + xhr.status + " " + xhr.statusText);
										stop = stop - 1;
									}
								}
							};
							xhr2.send(null);
						})(i, qid, result);
					}
					else {
						stop = stop - 1;
						continue;
					}
				}
			}
			else {
				Tomahawk.addTrackResults(empty);
			}
		});
	}
});

Tomahawk.resolver.instance = YoutubeResolver;
