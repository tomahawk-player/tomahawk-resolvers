var LastfmResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: 'Last.fm Resolver',
		weight: 85,
		timeout: 5
	},
	apiCall: function(artist, track)
	{
		artist = encodeURIComponent(artist).replace(/\%20/g,'\+').trim();
		track = encodeURIComponent(track).replace(/\%20/g,'\+').trim();
		var lastfmUrl = "http://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=3ded6e3f4bfc780abecea04808abdd70&format=json&artist="+artist+"&track="+track;
		var beer = JSON.parse(Tomahawk.syncRequest(lastfmUrl))
		return beer;
	},
	parseSongResponse: function( qid, responseString )
	{
		var results = new Array();
		if (typeof responseString.track != "undefined" && responseString.track.freedownload)
		{
			var result = new Object();
			result.artist = responseString.track.artist.name;
			result.track = responseString.track.name;
			if (typeof responseString.track.album != "undefined"){
				result.album = responseString.track.album.title;
			}
			if (typeof responseString.track.year != "undefined"){
				result.year = responseString.track.year;
			}
			result.source = this.settings.name;
			result.url = responseString.track.freedownload;
			result.mimetype = "audio/mpeg";
			result.bitrate = 128;
			result.duration = responseString.track.duration/1000;
			result.score = 0.95;
			results.push(result);
		}
		var return1 =  {
			qid: qid,
			results: results
		};
		return return1;
	},
	resolve: function( qid, artist, album, title )
	{
		return this.search( qid, artist, album, title );
	},
	search: function( qid, artist, album, title )
	{
		var searchResult = this.apiCall(artist, title);
		return this.parseSongResponse( qid, searchResult );
	}
});

Tomahawk.resolver.instance = LastfmResolver;