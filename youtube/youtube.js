/*
 * Copyright (C) 2012 Hugo Lindström <hugolm84@gmail.com>
 * Copyright (C) 2012 Thierry Göckel <thierry@strayrayday.lu>
 * Copyright (C) 2012 Leo Franchi <lfranchi@kde.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * NOTICE: This resolver and its intent, is for demonstrational purposes only
 **/
var YoutubeResolver = Tomahawk.extend(TomahawkResolver, {
	
	getConfigUi: function ()
	{
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
			}, {
				name: "debugMode",
				widget: "debug",
				property: "checked"
			}],
			images: [{
				"youtube.png" : Tomahawk.readBase64("youtube.png")
			}]
		};
	},

	newConfigSaved: function ()
	{
		var userConfig = this.getUserConfig();
		if ((userConfig.includeCovers !== this.includeCovers) || (userConfig.includeRemixes !== this.includeRemixes) ||
			(userConfig.includeLive !== this.includeLive) || (userConfig.qualityPreference !== this.qualityPreference)) {

				this.includeCovers = userConfig.includeCovers;
				this.includeRemixes = userConfig.includeRemixes;
				this.includeLive = userConfig.includeLive;
				this.qualityPreference = userConfig.qualityPreference;
				this.debugMode = userConfig.debugMode;
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

	getTrack: function (trackTitle, origTitle, isSearch) {
		if ((this.includeCovers === false || this.includeCovers === undefined) && trackTitle.search(/(\Wcover(?!(\w)))/i) !== -1 && origTitle.search(/(\Wcover(?!(\w)))/i) === -1){
			return null;
		}
		// Allow remix:es in search results?
		if (isSearch === undefined ) {
			if ((this.includeRemixes === false || this.includeRemixes === undefined) && trackTitle.search(/(\W(re)*?mix(?!(\w)))/i) !== -1 && origTitle.search(/(\W(re)*?mix(?!(\w)))/i) === -1){
				return null;
			}
		}
		if ((this.includeLive === false || this.includeLive === undefined) && trackTitle.search(/(live(?!(\w)))/i) !== -1 && origTitle.search(/(live(?!(\w)))/i) === -1){
			return null;
		}
		else {
			return trackTitle;
		}
	},

	getBitrate: function (urlString)
	{
		//http://www.h3xed.com/web-and-internet/youtube-audio-quality-bitrate-240p-360p-480p-720p-1080p
		// No need to get higher than hd720, as it only will eat bandwith and do nothing for sound quality
		if (urlString.indexOf("quality=hd720") !== -1 ){
			return 192;
		}
		else if (urlString.indexOf("quality=medium") !== -1){
			return 128;
		}
		else if (urlString.indexOf("quality=small") !== -1){
			return 96;
		}
		// Probably
		return 128;
	},

	init: function()
	{
		// Set userConfig here
		var userConfig = this.getUserConfig();
		if ( userConfig !== undefined && userConfig.qualityPreference !== undefined ){
			this.includeCovers = userConfig.includeCovers;
			this.includeRemixes = userConfig.includeRemixes;
			this.includeLive = userConfig.includeLive;
			this.qualityPreference = userConfig.qualityPreference;
			this.debugMode = userConfig.debugMode;
		}
		else {
			this.includeCovers = false;
			this.includeRemixes = false;
			this.includeLive = false;
			this.qualityPreference = 1;
			this.debugMode = 1;
		}

		// Protos
		String.prototype.capitalize = function(){
			return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
		};
		String.prototype.regexIndexOf = function(regex, startpos) {
			var indexOf = this.substring(startpos || 0).search(regex);
			return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
		};
		String.prototype.splice = function( idx, rem, s ) {
			return (this.slice(0,idx) + s + this.slice(idx + Math.abs(rem)));
		};
	},

	hasPreferedQuality: function( urlString )
	{
		if (this.qualityPreference === undefined){
			this.debugMsg("ASSERT: quality undefined!");
			return true;
		}

		if (urlString.indexOf("quality="+this.getPreferedQuality()) !== -1 )
			return true;
		return false;
	},

	getPreferedQuality: function()
	{
		if (this.qualityPreference === undefined){
			this.qualityPreference = 0;
			return "hd720"
		}

		switch( this.qualityPreference ) {
			default:
			case 0 : return "hd720";
			case 1 : return "medium"
			case 2 : return "small";
		}
	},

	debugMsg: function(msg)
	{
		if( msg.toLowerCase().indexOf("assert") === 0)
			console.log(this.settings.name + msg);
		else if( this.debugMode ){
			Tomahawk.log(this.settings.name + "Debug: " + msg);
		}
	},

	parseVideoUrlFromYtPage: function(html)
	{
		// Youtube is sneaky, they switch fmt_map randomly
		// 1. url_encoded_fmt_stream_map": "itag=43\u0026url*
		// 2. url_encoded_fmt_stream_map=itag%3D43%26url*
		// 3. url_encoded_fmt_stream_map=itag%3D44%26url*
		// 4. url_encoded_fmt_stream_map=itag%3D45%26url*
		// 5. url_encoded_fmt_stream_map=itag%3D46%26url*
		var streamMatch = html.match(/(url_encoded_fmt_stream_map.*?url)(.*?)(?=(",|\\u0026amp))/i);

		if (!streamMatch) {
			var dasCaptcha = html.match(/www.google.com\/recaptcha\/api\/challenge?/i);
			if (dasCaptcha)
				this.debugMsg("Failed to parse url from youtube page. Captcha limitation in place.");
			else
				this.debugMsg("Failed to find stream_map in youtube page.");
			return null;
		}

		if (streamMatch[2] === undefined) {
			this.debugMsg("Failed to parse url from youtube page.");
			for ( var i = 1; i< streamMatch.length; i++)
				this.debugMsg("Match " + i + " = " + streamMatch[i] + "\n");
			return null;
		}

		var urls = streamMatch[2];
		var unescapedurls = unescape(urls);
		urls = unescapedurls.split(",");

		var urlsArray = [];
		for (i = 0; i < urls.length - 1; i++){
			// decodeUri and replace itag, url,  ;codec=blabla" as well as the sig, currently resides in the fallback url 
			var subUrl = decodeURIComponent( urls[i] ).replace(/\\u0026/gi, "&").replace(/\itag=(.[0-9]*?&url=)/g, "").replace(/\;(.*?)"&/g, "&").replace("sig", "signature");
			// decoded, url becomes =, but in our regex we dont really know, as they change it.
			if( subUrl.indexOf("=http") === 0 ) {
				subUrl = subUrl.substring(1);
			}
			if (subUrl.indexOf("url=") === 0 ) {
				subUrl = subUrl.substring(4);
			}
			if( subUrl.indexOf("http") !== 0 ){
				this.debugMsg("subUrl Fail! Parsed: " + subUrl + "\n");
				// This is also a bit sneaky, sometimes, there's a , delimiter in codec param
				continue;
			}

			// Append quality=large if hd720 isnt found? Need to check sound difference
			if( subUrl.regexIndexOf(/quality=(hd720|high|medium|small)/i, 0) !== -1) {
				urlsArray.push(subUrl);
			}
		}

		var finalUrl;

		if (this.qualityPreference === undefined){
			// This shouldnt happen really, but sometimes do?!
			this.qualityPreference = 0;
			this.debugMsg("Critical: Failed to set qualitypreference in init, resetting to " + this.qualityPreference);
		}

		for (i = 0; i < urlsArray.length; i++){
			if (this.hasPreferedQuality(urlsArray[i])){
				finalUrl = urlsArray[i];
			}
		}

		if (finalUrl === undefined) {
			finalUrl = urlsArray[0];
		}

		if (finalUrl && finalUrl !== undefined) {
			return finalUrl;
		}
		return null;
	},

	magicCleanup: function(toClean)
	{
		return toClean.replace(/[^A-Za-z0-9 ]|(feat|ft.|featuring|prod|produced|produced by)/g, "").replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ').toLowerCase();
	},

	resolve: function(qid, artist, album, title)
	{
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
			if (resp.data.totalItems !== 0){
				var stop = Math.min(limit, resp.data.totalItems);
				for (i = 0; i < Math.min(limit, resp.data.totalItems); i++) {
					if (resp.data.items[i] === undefined){
						stop = stop - 1;
						continue;
					}
					var responseItem = resp.data.items[i];
					if (responseItem.duration === undefined){
						stop = stop - 1;
						continue;
					}
					// ContentRating, eg. User needs to verify age or similar that requires login
					if (responseItem.contentRating !== undefined ){
						stop = stop - 1;
						continue;
					}
					var responseTitle = responseItem.title.toLowerCase();
					// Check whether the artist and title (if set) are in the returned title, discard otherwise
					if (responseTitle !== undefined && responseTitle.indexOf(artist.toLowerCase()) === -1 ||
					   (title !== "" && responseTitle.toLowerCase().indexOf(title.toLowerCase()) === -1)) {
						// Lets do a deeper check
						// Users tend to insert [ft. Artist] or **featuring Artist & someOther artist
						// Remove these
						var newTitle = that.magicCleanup(title);
						var newArtist = that.magicCleanup(artist);
						var newRespTitle = that.magicCleanup(responseTitle);

						if (newRespTitle !== undefined && newRespTitle.indexOf(newArtist) === -1 ||
						   (newTitle !== "" && newRespTitle.indexOf(newTitle) === -1)) {
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
							result.linkUrl += "&hd=1";
						}

						(function(i, qid, result) {
							Tomahawk.asyncRequest(responseItem.player['default'], function(xhr2) {
								result.url  = that.parseVideoUrlFromYtPage(xhr2.responseText, result);
								if ( result.url && result.url !== undefined) {
									// Get the expiration time, to be able to cache results in tomahawk
									var expires = result.url.match(/expire=([0-9]+)(?=(&))/);
									if ( expires && expires[1] !== undefined ) {
										result.expires = Math.floor(expires[1]);
									}
									result.bitrate = that.getBitrate(result.url);
									result.id = i;
									results.push(result);
									stop = stop - 1;
									if (stop === 0) {
										var best = i + 1;
										for (var j = 0; j < results.length; j++) {
											if (results[j].id < best || that.hasPreferedQuality( results[j].url)) {
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
					}
					else {
						stop = stop - 1;
					}
				}
				if (stop === 0){ // if no results had appropriate titles, return empty
					Tomahawk.addTrackResults(empty);
				}
			}
			else {
				Tomahawk.addTrackResults(empty);
			}
		});
	},

	cleanupAndParseTrack: function(title, searchString)
	{
		var result = {};
		// For the ease of parsing, remove these
		// Maybe we could up the score a bit?
		if( title.regexIndexOf(/(?:[([](?=(official))).*?(?:[)\]])|(?:(official|video)).*?(?:(video))/i, 0 ) !== -1 )
		{
			title = title.replace(/(?:[([](?=(official|video))).*?(?:[)\]])/gi, "");
			title = title.replace(/(official|video(?:([!:-])))/gi, "");
			result.isOfficial = 1;
		}
		result.query = title;
		// Sometimes users separate titles with quotes :
		// eg, "\"Young Forever\" Jay Z | Mr. Hudson (OFFICIAL VIDEO)"
		// this will parse out the that title
		var inQuote = title.match(/([""'])(?:(?=(\\?))\2.).*\1/g);
		if ( inQuote && inQuote !== undefined ) {
			result.track = inQuote[0].substr(1, inQuote[0].length-2);
			title = title.replace(inQuote[0],'');
			result.fromQuote = result.track;
			result.parsed = this.parseCleanTrack( title );
			if( result.parsed ){
				result.parsed.track = result.track;
				return result.parsed;
			}
		}
		else {
			result.parsed = this.parseCleanTrack( title );
			if( result.parsed )
				return result.parsed;
		}

		// Still no luck, lets go deeper
		if (!result.parsed) {
			if (title.toLowerCase().indexOf(searchString.toLowerCase()) !== -1) {
				result.parsed = this.parseCleanTrack(title.replace(RegExp(searchString, "gi"), searchString.concat(" :")));
			}
			else
			{
				var tryMatch = searchString.replace(/(?:[-|:&])/g, " ");
				if (title.toLowerCase().indexOf(tryMatch.toLowerCase()) !== -1) {
					var replaceWith;
					if (title.regexIndexOf(/(?:[-|:&])/g, 0) !== -1)
						replaceWith = searchString;
					else
						replaceWith = searchString.concat(" : ");
					result.parsed = this.parseCleanTrack( title.replace(RegExp(tryMatch, "gi"), replaceWith));
				}
			}
		}

		if (result.fromQuote && result.fromQuote !== undefined) {
			if (result.parsed)
				result.artist = result.parsed.artist;
			result.track = result.fromQuote;
		}
		else if (result.parsed) {
			if (result.parsed.artist !== undefined) {
				result.artist = result.parsed.artist;
			}
			if (result.parsed.track !== undefined) {
				result.track = result.parsed.track;
			}
		}
		delete result.parsed;
		return result;
	},

	parseCleanTrack: function(track)
	{
		var result = {};
		result.query = track;
		result.query.replace(/.*?(?=([-:|]\s))/g, function (param) {
			if( param !== "" ) {
				if( result.artist === undefined ) {
					result.artist = param;
				}
				else {
					if( result.track === undefined )
						result.track = param;
				}
			}
		});

		result.query.replace(/(?=([-:|]\s)).*/g, function (param) {
			if( param !== "" ) {
				if( param.regexIndexOf(/([-|:]\s)/g, 0) === 0 ) {
					if(result.track === undefined)
						result.track = param.replace(/([-|:]\s)/g, "");
				}
				else {
					if(tyresult.artist === undefined)
						result.artist = param;
					result.track = result.replace(/([-|:]\s)/g, "")
				}
			}
		});

		if (result.track !== undefined && result.artist !== undefined ){
			// Now, lets move featuring to track title, where it belongs
			var ftmatch = result.artist.match(/(?:(\s)(?=(feat.|feat|ft.|ft|featuring)(?=(\s)))).*/gi);
			if( ftmatch ){
				result.artist = result.artist.replace(ftmatch, "");
				result.track += " " + ftmatch;
			}
			// Trim
			result.track = result.track.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');
			result.artist = result.artist.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');
			return result;
		}
		return null;
	},

	// Allows async requests being made with userdata
	asyncRequest: function (url, userdata, callback)
	{
		var xmlHttpRequest = new XMLHttpRequest();
		xmlHttpRequest.open('GET', url, true);
		xmlHttpRequest.onreadystatechange = function() {
			if (xmlHttpRequest.readyState == 4 && xmlHttpRequest.status == 200) {
				callback.call(window, xmlHttpRequest, userdata);
			} else if (xmlHttpRequest.readyState === 4) {
				Tomahawk.log("Failed to do GET request: to: " + url);
				Tomahawk.log("Status Code was: " + xmlHttpRequest.status);
			}
		}
		xmlHttpRequest.send(null);
	},

	sendEmptyResult: function(qid, searchString)
	{
		Tomahawk.log("No results for " + searchString);
		var empty = {
			results: [],
			qid: qid
		};
		Tomahawk.addTrackResults(empty);
	},
	 
	handleItemResponse: function(qid, searchString, data)
	{
		var results = new Array();
		var artists = new Object();
		// r
		//var artistLookupUrl = "http://developer.echonest.com/api/v4/artist/search?api_key=FILDTEOIK2HBORODV&format=json&results=1&name=";
		var artistLookupUrl = "http://ws.audioscrobbler.com/2.0/?method=artist.search&api_key=b14d61bf2f7968731eb686c7b4a1516e&format=json&limit=1&artist=";
		var that = this;
		var count = 0;
		for (i = 0; i < data.totalItems; i++) {

			if (data.items[i] === undefined){
				continue;
			}

			if (data.items[i].duration === undefined) {
				continue;
			}

			// Check whether the artist and title (if set) are in the returned title, discard otherwise
			if (data.items[i].title === undefined) {
				continue;
			}

			// ContentRating, eg. User needs to verify age or similar that requires login
			// May also indicate country restrictions
			// @todo: Check user geo? may be found in result url, &gcr=COUNTRY_SHORT_CODE
			//        Value to be catched is then contentRating.GEOCODE
			//        If contentRating is just 1, login is required
			if (data.items[i].contentRating !== undefined ) {
				continue;
			}

			// Dirty check, filters out the most of the unwanted results
			var searchFoundItem = data.items[i].title.replace(/([^A-Za-z0-9\s])/gi, "").replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,'|');
			var searchStringItem = searchString.replace(/([^A-Za-z0-9\s])/gi, "").replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,'|');
			var matches = searchFoundItem.match(RegExp(searchStringItem, "gi"));
			if( !matches ){
				continue;
			}

			if( matches.length !== searchStringItem.split("|").length ) {
				this.debugMsg("Skipping: " + data.items[i].title + " Matches: " + matches.length );
				this.debugMsg("Searched: " + searchString  + " Matches: " + searchStringItem.split("|").length );
				continue;
			}

			var track = data.items[i].title;
			var parsedTrack = this.cleanupAndParseTrack(track, searchString );

			if( !parsedTrack || parsedTrack.artist === undefined || parsedTrack.artist === undefined ) {
				this.debugMsg( "Failed to get a possitive match for : " + track);
				continue;
			}
			if (this.getTrack(track, searchString, true)) {
				var result = new Object();
				result.source = this.settings.name;
				result.mimetype = "video/h264";
				result.duration = data.items[i].duration;
				result.score = (parsedTrack.isOfficial !== undefined ? 0.85 : 0.95 );
				result.year = data.items[i].uploaded.slice(0,4);
				result.url = data.items[i].player['default'];
				result.query = searchString;
				result.artist = parsedTrack.artist;
				result.track = parsedTrack.track;
				result.linkUrl = data.items[i].player['default'];
				if (that.qualityPreference === 0) {
					result.linkUrl += "&hd=1";
				}
				results.push(result);

				// Lets just do one artist lookup query, instead of on all of them
				var artist = result.artist.toLowerCase();
				if( artists[artist] )
					artists[artist].push(count);
				else
					artists[artist] = [count];

				result.id = count++;
			}
		}

		if ( count == 0 )
		{
			this.debugMsg("Search results where empty for " + searchString);
			this.sendEmptyResult(qid, searchString);
			return;
		}

		var finalResults = [];
		for ( var artistKey in artists ) {
			this.asyncRequest(artistLookupUrl+artistKey, artists[artistKey], function(xhr, ids) {
				var response = JSON.parse(xhr.responseText);
				if (response.results.artistmatches.artist !== undefined) {
					var artist = response.results.artistmatches.artist.name;
					for (var i = 0; i < ids.length; i++) {
						that.asyncRequest( results[ids[i]].url, {id: ids[i], artist: artist, results: results}, function(xhr, userdata) {
							var url = that.parseVideoUrlFromYtPage(xhr.responseText);
							if (url) {
								userdata.results[userdata.id].url = url;
								userdata.results[userdata.id].bitrate = that.getBitrate(url);
								userdata.results[userdata.id].artist = userdata.artist;
								var expires = url.match(/expire=([0-9]+)(?=(&))/);
								if ( expires && expires[1] !== undefined ){
									userdata.results[userdata.id].expires = Math.floor(expires[1]);
								}
								that.debugMsg("Added " + count + " " + userdata.results[userdata.id].url +  "\n");
								finalResults.push(userdata.results[userdata.id]);
								if (count-1 == 0 ){
									var return1 = {
										results: finalResults,
										qid: qid
									};
									Tomahawk.addTrackResults(return1);
									return;
								}
							}
							else {
								that.debugMsg("Failed on " + userdata.results[userdata.id].url + " count : " + count);
							}
							count--;
						});
					}
				}
				else {
					that.debugMsg("Bad name?" + JSON.stringify(response.results["opensearch:Query"], 4, null));
					count = count-ids.length
				}
			});
		}
	},

	search: function( qid, searchString )
	{
		var limit = 50;
		var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q=" + encodeURIComponent(searchString) + "&v=2&alt=jsonc&quality="+this.getPreferedQuality()+"&max-results=" +limit+"&category=Music";
		apiQuery = apiQuery.replace(/\%20/g, '\+');
		var that = this;

		Tomahawk.asyncRequest(apiQuery, function(xhr) {
			var resp = JSON.parse(xhr.responseText);
			if (resp.data.totalItems !== 0) {
				that.handleItemResponse(qid, searchString, resp.data);
			}
			else {
				that.sendEmptyResult(qid, searchString);
			}
		});
	}
});

Tomahawk.resolver.instance = YoutubeResolver;
