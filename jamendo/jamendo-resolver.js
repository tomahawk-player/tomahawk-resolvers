/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */

var JamendoResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: 'Jamendo',
		weight: 75,
		timeout: 5
	},
	sendRequest: function (url) {
		// send request and parse it into javascript
		var xmlString = Tomahawk.syncRequest(url);
		
		// parse xml
		var domParser = new DOMParser();
		xmlDoc = domParser.parseFromString(xmlString, "text/xml");
		
		var results = new Array();
		var r = xmlDoc.getElementsByTagName("data");
		// check the response
		if(r.length > 0 && r[0].childNodes.length > 0)
		{
		    var links = xmlDoc.getElementsByTagName("track");
		
		    // walk through the results and store it in 'results'
		    for(var i=0;i<links.length;i++)
		    {
		    	var link = links[i];
		
				var result = new Object();
				result.artist = Tomahawk.valueForSubNode(link, "artist_name");
				result.album = Tomahawk.valueForSubNode(link, "album_name");
				result.track = Tomahawk.valueForSubNode(link, "name");
				//result.year = Tomahawk.valueForSubNode(link, "year");
				
				result.source = this.settings.name;
				result.url = decodeURI(Tomahawk.valueForSubNode(link, "stream"));
				// jamendo also provide ogg ?
				result.extension = "mp3";
				//result.bitrate = Tomahawk.valueForSubNode(link, "bitrate")/1000;
				result.duration = Tomahawk.valueForSubNode(link, "duration");
				result.score = 1.0;
				
				results.push(result);
		     }
		}
		return results;
	},
	resolve: function( qid, artist, album, title )
	{	
		// build query to Jamendo
		var url = "http://api.jamendo.com/get2/id+name+duration+stream+album_name+artist_name/track/xml/track_album+album_artist/?";
		if(title !== "" )
			url += "name=" + encodeURIComponent(title) + "&";
		
		if(artist !== "" )
			url += "artist_name=" + encodeURIComponent(artist) + "&";
		
		if(album !== "" )
			url += "album_name=" + encodeURIComponent(album) + "&";
		
		url += "n=20";
		
		var results = this.sendRequest(url);
		return this.returnResult(qid, results);
	},
	search: function( qid, searchString )
	{
				// build query to Jamendo
		var url = "http://api.jamendo.com/get2/id+name+duration+stream+album_name+artist_name/track/xml/track_album+album_artist/?";
		if(searchString !== "" )
			url += "searchquery=" + encodeURIComponent(searchString);
		
		url += "&n=20";
		var results = this.sendRequest(url);
		return this.returnResult(qid, results);
	},
	returnResult: function (qid, results) {
		var return1 =  {
			qid: qid,
			results: results
		};
		return return1;
	}
});

Tomahawk.resolver.instance = JamendoResolver;