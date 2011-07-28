/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */

var JamendoResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: 'Jamendo Resolver',
		weight: 75,
		timeout: 5
	},
	resolve: function( qid, artist, album, title )
	{
		return this.search( qid, artist, album, title );
	},
	search: function( qid, artist, album, title )
	{
		var valueForSubNode = function(node, tag)
		{
			return node.getElementsByTagName(tag)[0].textContent;
		};
		
		// build query to Jamendo
		var url = "http://api.jamendo.com/get2/id+name+duration+stream+album_name+album_url+artist_name+artist_url/track/xml/track_album+album_artist/?";
		if(title !== "" )
			url += "name=" + encodeURIComponent(title) + "&";
		
		if(artist !== "" )
			url += "artist_name=" + encodeURIComponent(artist) + "&";
		
		if(album !== "" )
			url += "album_name=" + encodeURIComponent(album) + "&";
		
		url += "n=all";
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
				result.artist = valueForSubNode(link, "artist_name");
				result.album = valueForSubNode(link, "album_name");
				result.track = valueForSubNode(link, "name");
				//result.year = valueForSubNode(link, "year");
				
				result.source = this.settings.name;
				result.url = decodeURI(valueForSubNode(link, "stream"));
				// jamendo also provide ogg ?
				result.extension = "mp3";
				//result.bitrate = valueForSubNode(link, "bitrate")/1000;
				result.duration = valueForSubNode(link, "duration");
				result.score = 1.0;
				
				results.push(result);
		     }
		}
       	var return1 =  {
			qid: qid,
			results: results
		};
		return return1;
	}
});

Tomahawk.resolver.instance = JamendoResolver;