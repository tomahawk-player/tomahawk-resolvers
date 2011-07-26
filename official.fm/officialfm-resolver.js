/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */

var OfficialfmResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: 'Official.fm Resolver',
		weight: 70,
		timeout: 5
	},
	resolve: function( qid, artist, album, title )
	{
		return this.search( qid, artist, album, title );
	},
	search: function( qid, artist, album, title )
	{
		var applicationKey = "ixHOUAG9r9csybvGtGuf";
    
    	var valueForSubNode = function(node, tag)
    	{
        	return node.getElementsByTagName(tag)[0].textContent;
    	};

    	// build query to Official.fm
    	var url = "http://api.official.fm/search/tracks/";
   	 	var request = "";
    	if(title !== "" )
        	request += title + " ";

   		if(artist !== "" )
        	request += artist + " ";

	    url += encodeURIComponent(request);
    
    	url += "?key=" + applicationKey;
    	// send request and parse it into javascript
    	var xmlString = Tomahawk.syncRequest(url);

    	// parse xml
    	var domParser = new DOMParser();
   		xmlDoc = domParser.parseFromString(xmlString, "text/xml");

    	var results = new Array();
    	// check the response
    	if(xmlDoc.getElementsByTagName("tracks")[0].childNodes.length > 0) 
    	{
        	var links = xmlDoc.getElementsByTagName("track");

        	// walk through the results and store it in 'results'
        	for(var i=0;i<links.length;i++)
        	{
            	var link = links[i];
	            var result = new Object();
	            result.artist = valueForSubNode(link, "artist_string");
	            result.album = album;
	            result.track = valueForSubNode(link, "title");

	            result.source = this.settings.name;
	            result.duration = valueForSubNode(link, "length");
	            result.score = 0.95;
	            result.id = valueForSubNode(link, "id");
            	if(result.artist == artist && result.track == title) 
            	{           
	               	var urlStream = 'http://api.official.fm/track/'+result.id+'/stream?key='+applicationKey+"&format=json";
	               
	                var t = JSON.parse(Tomahawk.syncRequest(urlStream));
	                result.url = t.stream_url;
	                result.mimetype = "audio/mpeg";
	                results.push(result);
            	}
        	}
        	var return1 =  {
				qid: qid,
				results: results
			};
			return return1;
    	}
	}
});

Tomahawk.resolver.instance = OfficialfmResolver;