var SoundcloudResolver = Tomahawk.extend(TomahawkResolver, {
	
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
			}],
			images: [{
				"soundcloud.png" : Tomahawk.readBase64("soundcloud.png")
			}]
		};
	},

	newConfigSaved: function () {
		var userConfig = this.getUserConfig();
		if((userConfig.includeCovers != this.includeCovers) || (userConfig.includeRemixes != this.includeRemixes) || (userConfig.includeLive != this.includeLive)) {
			this.includeCovers = userConfig.includeCovers;
			Tomahawk.log("Include Covers is set to: " + this.includeCovers);
			this.includeRemixes = userConfig.includeRemixes;
			Tomahawk.log("Include Remixes is set to: " + this.includeRemixes);
			this.includeLive = userConfig.includeLive;
			Tomahawk.log("Include Live is set to: " + this.includeLive);
		}
	},
	
	settings: {
		name: 'Soundcloud',
		weight: 85,
		timeout: 5
	},
	
	init: function() {
		String.prototype.capitalize = function(){
		return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
		};
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

	searchSoundcloud: function( qid, query, title, artist ) {
		var apiQuery = "http://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q=" + query;
		var that = this;
		Tomahawk.asyncRequest(apiQuery, function(xhr) {
			var resp = JSON.parse(xhr.responseText);
			if (resp.length === 0){
				return;
			}
			
			var results = [];
			var stop = 0;
			if (title !== ""){ 
				stop = 1;
			}
			else{ 
				stop = resp.length;
			}
			for (i = 0; i < stop; i++) {
				// Need some more validation here
				// This doesnt help it seems, or it just throws the error anyhow, and skips?
				if(resp[i] === undefined){
					continue;
				}
	
				// Check whether the artist and title (if set) are in the returned title, discard otherwise
				if (resp[i].title !== undefined && resp[i].title.toLowerCase().indexOf(artist.toLowerCase()) === -1 || (title !== "" && resp[i].title.toLowerCase().indexOf(title.toLowerCase()) === -1)) {
					continue;
				}
				var result = new Object();
				if (artist !== "") {
					result.artist = artist;
				}
				if (that.getTrack(resp[i].title, title)){
					if (title !== ""){
						result.track = title;
					}
					else {
						if (resp[i].title.toLowerCase().indexOf(artist.toLowerCase() + " - ") === 0){
							result.track = resp[i].title.slice((artist.toLowerCase() + " - ").length);
						}
						else if (resp[i].title.toLowerCase().indexOf(artist.toLowerCase() + " — ") === 0){
							result.track = resp[i].title.slice((artist.toLowerCase() + " — ").length);
						}
						else {
							result.track = resp[i].title; // remove artist from here
						}
					}
				}
				else {
					continue;
				}
	
				
				result.source = that.settings.name;
				result.mimetype = "audio/mpeg";
				result.bitrate = 128;
				result.duration = resp[i].duration / 1000;
				result.score = 0.85;
				result.year = resp[i].release_year;
				result.url = resp[i].stream_url + ".json?client_id=TiNg2DRYhBnp01DA3zNag";
				results.push(result);
			}
			var return1 = {
				qid: qid,
				results: results
			};
			Tomahawk.addTrackResults(return1);
		});
	},

	resolve: function(qid, artist, album, title)
	{
		if (artist !== "") {
			query = encodeURIComponent(artist) + "+";
		}
		if (title !== "") {
			query += encodeURIComponent(title);
		}
		this.searchSoundcloud(qid, query, title, artist);
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
				
				Tomahawk.log("Found artist " + artist + " for search string \"" + searchString + "\"");
				
				that.searchSoundcloud(qid, searchString, "", artist);
			}
		});
	}
});

Tomahawk.resolver.instance = SoundcloudResolver;