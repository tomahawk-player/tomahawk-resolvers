var YoutubeResolver = Tomahawk.extend(TomahawkResolver, {
	
	getConfigUi: function () {
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

	newConfigSaved: function () {
		var userConfig = this.getUserConfig();
		if((userConfig.includeCovers !== this.includeCovers) || (userConfig.includeRemixes !== this.includeRemixes) || (userConfig.includeLive !== this.includeLive) || (userConfig.qualityPreference !== this.qualityPreference)) {
			this.includeCovers = userConfig.includeCovers;
			this.includeRemixes = userConfig.includeRemixes;
			this.includeLive = userConfig.includeLive;
			this.qualityPreference = userConfig.qualityPreference;
		}
	},
	
	settings:
	{
		name: 'YouTube',
		weight: 70,
		timeout: 15
	},
	
	getTrack: function (trackTitle, origTitle) {
		if ((this.includeCovers === false || this.includeCovers === undefined) && trackTitle.search(/cover/i) !== -1 && origTitle.search(/cover/i) === -1){
			return null;
		}
		if ((this.includeRemixes === false || this.includeRemixes === undefined) && trackTitle.search(/remix/i) !== -1 && origTitle.search(/remix/i) === -1){
			return null;
		}
		if ((this.includeLive === false || this.includeLive === undefined) && trackTitle.search(/live/i) !== -1 && origTitle.search(/live/i) === -1){
			return null;
		}
		else {
			return trackTitle;
		}
	},
		
	init: function() {
		String.prototype.capitalize = function(){
		return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
		};
	},
	
	parseVideoUrlFromYtPage: function (html) {
		var magic = "url_encoded_fmt_stream_map\": \"url=";
		var magicLimit = "\", ";
		var pos = html.indexOf(magic) + magic.length;
		html = html.slice(pos);
		var urls = html.slice(0, html.indexOf(magicLimit));
		urls = urls.split("fallback_host=");
		var urlsArray = [];
		for (i = 0; i < urls.length - 1; i++){
			var startUrl = "url=";
			var stopUrl = "\\u0026";
			var startSlice;
			if (urls[i].indexOf(startUrl) !== -1){ //We don't want to slice if startUrl is not found
				startSlice = urls[i].indexOf(startUrl) + startUrl.length;
			}
			else {
				startSlice = 0;
			}
			var subUrl = urls[i].slice(startSlice);
			subUrl = subUrl.slice(0, subUrl.lastIndexOf(stopUrl));
			subUrl = decodeURIComponent(subUrl).replace(/%2C/g, ",").replace(/\\u0026/g, "&");
			if (subUrl.indexOf("quality=hd720") !== -1 || subUrl.indexOf("quality=medium") !== -1 || subUrl.indexOf("quality=small") !== -1) {
				urlsArray.push(subUrl);
			}
		}
		var finalUrl;
		if(!this.qualityPreference){
			this.qualityPreference = 1;
		}		
		if(this.qualityPreference === 0){
			finalUrl = urlsArray[0];
		}
		if(this.qualityPreference === 1){
			for (i = 0; i < urlsArray.length; i++){
				if(urlsArray[i].indexOf("quality=medium") !== -1){
					finalUrl = urlsArray[i];
				}
			}
			if(finalUrl === undefined){
				for (i = 0; i < urlsArray.length; i++){
					if(urlsArray[i].indexOf("quality=small") !== -1){
						finalUrl = urlsArray[i];
					}
				}
			}
			if(finalUrl === undefined){
				finalUrl = urlsArray[0];
			}
		}
		if(this.qualityPreference === 2){
			for (i = 0; i < urlsArray.length; i++){
				if(urlsArray[i].indexOf("quality=small") !== -1){
					finalUrl = urlsArray[i];
				}
			}
			if(finalUrl === undefined){
				for (i = 0; i < urlsArray.length; i++){
					if(urlsArray[i].indexOf("quality=medium") !== -1){
						finalUrl = urlsArray[i];
					}
				}
			}
			if(finalUrl === undefined){
				finalUrl = urlsArray[0];
			}
		}
		return finalUrl;
	},
	
	searchYoutube: function( qid, query, limit, title, artist ) {
		var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q=" + query + "&v=2&alt=jsonc&quality=medium&max-results=" + limit;
		apiQuery = apiQuery.replace(/\%20/g, '\+');
		var that = this;
		Tomahawk.asyncRequest(apiQuery, function(xhr) {
			var resp = JSON.parse(xhr.responseText);
			if (resp.data.totalItems === 0){
				return;
			}
			
			var results = [];
			var stop = Math.min(limit, resp.data.totalItems);
			for (i = 0; i < Math.min(limit, resp.data.totalItems); i++) {
				// Need some more validation here
				// This doesnt help it seems, or it just throws the error anyhow, and skips?
				if(resp.data.items[i] === undefined){
					stop = stop - 1;
					continue;
				}
				if(resp.data.items[i].duration === undefined){ //TODO don't be that strict here
					stop = stop -1;
					continue;
				}
	
				// Check whether the artist and title (if set) are in the returned title, discard otherwise
				if (resp.data.items[i].title !== undefined && resp.data.items[i].title.toLowerCase().indexOf(artist.toLowerCase()) === -1 || (title !== "" && resp.data.items[i].title.toLowerCase().indexOf(title.toLowerCase()) === -1)) {
					stop = stop - 1;
					continue;
				}
				var result = new Object();
				if (artist !== "") {
					result.artist = artist;
				}
				if (that.getTrack(resp.data.items[i].title, title)){
					if (title !== ""){
						result.track = title;
					}
					else {
						if (resp.data.items[i].title.toLowerCase().indexOf(artist.toLowerCase() + " - ") === 0){
							result.track = resp.data.items[i].title.slice((artist.toLowerCase() + " - ").length);
						}
						else {
							result.track = resp.data.items[i].title; // remove artist from here
						}
					}
				}
				else {
					stop = stop - 1;
					continue;
				}
	
				
				result.source = that.settings.name;
				result.mimetype = "video/h264";
				//result.bitrate = 128;
				result.duration = resp.data.items[i].duration;
				result.score = 0.85;
				result.year = resp.data.items[i].uploaded.slice(0,4);
				
				(function(i, qid, result) {
					var xmlHttpRequest = new XMLHttpRequest();
					xmlHttpRequest.open('GET', resp.data.items[i].player['default'], true);
					xmlHttpRequest.onreadystatechange = function() {
						if (xmlHttpRequest.readyState === 4){
							if(xmlHttpRequest.status === 200) {
								result.url = that.parseVideoUrlFromYtPage(xmlHttpRequest.responseText);
								if (result.url !== undefined && result.url.indexOf("http") === 0 && result.url.indexOf("</body>") === -1) {
									results.push(result);
									stop = stop - 1;
								}
								else {
									stop = stop - 1;
								}	
							}
							else {
								Tomahawk.log("Failed to do GET request to: " + resp.data.items[i].player['default']);
								Tomahawk.log("Error: " + xmlHttpRequest.status + " " + xmlHttpRequest.statusText);
							}
						}
						if (stop === 0) {
							var toReturn = {
								results: results,
								qid: qid
							};
							if (title !== ""){ // resolve
								var resolveReturn = {
									results: [toReturn.results[0]],
									qid: qid
								};
								Tomahawk.addTrackResults(resolveReturn);
							}
							else { // search
								Tomahawk.addTrackResults(toReturn);
							}
						}
					};
					xmlHttpRequest.send(null);
				})(i, qid, result);
			}
		});
	},
	
	resolve: function(qid, artist, album, title)
	{
		if (artist !== "") {
			query = encodeURIComponent(artist) + "%20";
		}
		if (title !== "") {
			query += encodeURIComponent(title);
		}

		this.searchYoutube(qid, query, 10, title, artist);
	},
	
	search: function( qid, searchString )
	{
		// First we get the artist name out of the search string with echonest's artist/extract function
		// HACK because Echo Nest is case-sensitive for artist/extract. we capitalize all words in the query just as a precaution. maybe a bad idea..
		// NOTE that this can often be slow, so the results can time out. However, Tomahawk can't deal with results without artists, so we *need an artist, so we try anyway
		searchString = encodeURIComponent(searchString.capitalize());
		var url = "http://developer.echonest.com/api/v4/artist/extract?api_key=JRIHWEP6GPOER2QQ6&format=json&results=1&sort=hotttnesss-desc&text=" + searchString;
		var that = this;
		Tomahawk.asyncRequest(url, function(xhr) {
			var response = JSON.parse(xhr.responseText).response;
			var artist = "";
			if (response && response.artists && response.artists.length > 0) {
				artist = response.artists[0].name;				
				that.searchYoutube(qid, searchString, 20, "", artist);
			}
		});
	}
});

Tomahawk.resolver.instance = YoutubeResolver;