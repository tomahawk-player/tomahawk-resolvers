/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */
var ExfmResolver = Tomahawk.extend(TomahawkResolver, {
	settings: {
		name: 'Ex.fm',
		icon: 'exfm-icon.png',
		weight: 30,
		timeout: 5
	},

    cleanTitle: function (title, artist) {
        // If the title contains a newline character, strip them off and remove additional spacing
        var newTitle = "";
        if (title.indexOf("\n") !== -1) {
            var stringArray = title.split("\n");
            for (var j = 0; j < stringArray.length; j++) {
                newTitle += stringArray[j].trim() + " ";
            }
            newTitle = newTitle.trim();
        } else {
            newTitle = title;
        }
        // Remove dash and quotation characters.
		newTitle = newTitle.replace("\u2013","").replace("  ", " ").replace("\u201c","").replace("\u201d","");
        // If the artist is included in the song title, cut it
        if (newTitle.toLowerCase().indexOf(artist.toLowerCase() + " -") === 0) {
            newTitle = newTitle.slice(artist.length + 2).trim();
        } else if (newTitle.toLowerCase().indexOf(artist.toLowerCase() + "-") === 0) {
            newTitle = newTitle.slice(artist.length + 1).trim();
        } else if (newTitle.toLowerCase().indexOf(artist.toLowerCase()) === 0){
            // FIXME: This might break results where the artist name is a substring of the song title.
            newTitle = newTitle.slice(artist.length).trim();
        }
        return newTitle;
    },

	resolve: function (qid, artist, album, title) {
		// Build search query for ex.fm
		var url = "http://ex.fm/api/v3/song/search/";
		url += encodeURIComponent(title);
		url += "?start=0&results=20&client_id=tomahawk";

		// send request and parse it into javascript
		var that = this;
		var xmlString = Tomahawk.asyncRequest(url, function(xhr) {
			// parse json
			var response = JSON.parse(xhr.responseText);

			var results = new Array();

			// check the response
			if (response.results > 0) {
				var songs = response.songs;

				// walk through the results and store it in 'results'
				for (var i = 0; i < songs.length; i++) {
					var song = songs[i];
					var result = new Object();
					if(song.url.indexOf("http://api.soundcloud") === 0){ // unauthorised, use soundcloud resolver instead
						continue;
					}

                    if (song.artist === null || song.title === null) {
                        // This track misses relevant information, so we are going to ignore it.
                        continue;
                    }
                    var dTitle = that.cleanTitle(song.title, song.artist)
					var dArtist = song.artist;
					if (song.album !== null) {
						var dAlbum = song.album;
					}
					if (dTitle.toLowerCase().indexOf(title.toLowerCase()) !== -1 && dArtist.toLowerCase().indexOf(artist.toLowerCase()) !== -1 || artist === "" && album === ""){
						result.artist = ((dArtist !== "")? dArtist:artist);
						result.album = ((dAlbum !== "")? dAlbum:album);
						result.track = ((dTitle !== "")? dTitle:title);
						result.source = that.settings.name;
						result.url = song.url;
						result.extension = "mp3";
						result.score = 0.80;
						results.push(result);
					}
					if (artist !== "") { // resolve, return only one result
						break;
					}
				}
			}

			var return1 = {
				qid: qid,
				results: results
			};
			Tomahawk.addTrackResults(return1);
		});
	},

	search: function (qid, searchString) {
		this.settings.strictMatch = false;
		this.resolve(qid, "", "", searchString);
	}
});

Tomahawk.resolver.instance = ExfmResolver;
