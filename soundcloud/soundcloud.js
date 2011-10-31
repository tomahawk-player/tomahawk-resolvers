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
			this.includeRemixes = userConfig.includeRemixes;
			this.includeLive = userConfig.includeLive;
		}
	},
	
	settings: {
		name: 'Soundcloud',
		weight: 85,
		timeout: 5
	},

	getTrack: function (trackTitle, origTitle) {
		if (this.includeCovers == "false" && trackTitle.search(/cover/i) != -1 && origTitle.search(/cover/i) == -1){
			return null;
		}
		if (this.includeRemixes == "false" && trackTitle.search(/remix/i) != -1 && origTitle.search(/remix/i) == -1){
			return null;
		}
		if (this.includeLive == "false" && trackTitle.search(/live/i) != -1 && origTitle.search(/live/i) == -1){
			return null;
		}
		else {
			return trackTitle;
		}
	},

	parseSongResponse: function (qid, artist, title, responseString) {
		var userConfig = this.getUserConfig();
		var results = new Array();
		if (responseString !== null) {
			for (i = 0; i < responseString.length; i++) {
				var result = new Object();
				result.artist = artist;
				if (responseString[i].title != undefined && responseString[i].title.search(new RegExp(artist, "gi")) != -1 && responseString[i].title.search(new RegExp(title, "gi")) != -1 && this.getTrack(responseString[i].title, title)){
					result.track = title;
				}
				else {
					continue;
				}
				result.album = "";
				result.year = responseString[i].release_year;
				result.source = "SoundCloud";
				result.url = responseString[i].stream_url + ".json?client_id=TiNg2DRYhBnp01DA3zNag";
				result.mimetype = "audio/mpeg";
				result.bitrate = 128;
				result.duration = responseString[i].duration / 1000;
				result.score = 1.00;
				results.push(result);
			}
			var return1 = {
				qid: qid,
				results: results
			};
			Tomahawk.addTrackResults(return1);
		}
	},

	resolve: function (qid, artist, album, title) {
		artist = encodeURIComponent(artist).replace(/\%20/g, '\+').trim();
		track = encodeURIComponent(title).replace(/\%20/g, '\+').trim();
		var soundcloudUrl = "http://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q=" + artist + "+" + track;
		var that = this;
		Tomahawk.asyncRequest(soundcloudUrl, function(xhr) {
			var resp = JSON.parse(xhr.responseText);
			that.parseSongResponse(qid, artist, title, resp);
		});
	},

	search: function (qid, searchString) {
		// Soundcloud can't return an artist thus search is disabled for this resolver, sorry
		return this.parseSongResponse(qid, "", "");
	}
});

Tomahawk.resolver.instance = SoundcloudResolver;