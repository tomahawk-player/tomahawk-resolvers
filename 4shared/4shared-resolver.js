/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */

var FSharedResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: '4shared Resolver',
		weight: 50,
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
	
	    // build query to 4shared
	    var url = "http://search.4shared.com/network/searchXml.jsp?q=";
	    var request = "";
	    if(title !== "" )
	        request += title + " ";
	
	    if(artist !== "" )
	        request += artist + " ";
	    
	    url += encodeURIComponent(request)
	    
	    url += "&searchExtention=mp3&sortType=1&sortOrder=1&searchmode=3";
	    // send request and parse it into javascript
	    var xmlString = Tomahawk.syncRequest(url);
	
	    // parse xml
	    var domParser = new DOMParser();
	    xmlDoc = domParser.parseFromString(xmlString, "text/xml");
	
	    var results = new Array();
	    // check the response
	    if(xmlDoc.getElementsByTagName("result-files")[0].childNodes.length > 0)
	    {
	        var links = xmlDoc.getElementsByTagName("file");
	
	        // walk through the results and store it in 'results'
	        for(var i=0; i<links.length; i++)
	        {
	            var link = links[i];
	
	            var result = new Object();
	            result.artist = artist;
	            result.album = album;
	            result.track = title;
	            //result.year = valueForSubNode(link, "year");
	
	            result.source = this.settings.name;
	            result.url = decodeURI(valueForSubNode(link, "flash-preview-url"));
	    
	            result.extension = "mp3";
	            //result.bitrate = valueForSubNode(link, "bitrate")/1000;
	            result.bitrate = 128;
	            //result.duration = valueForSubNode(link, "duration");
	            result.score = 0.80;
	
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

Tomahawk.resolver.instance = FSharedResolver;
