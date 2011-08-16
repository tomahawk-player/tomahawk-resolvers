/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */

var YouTubeResolver = Tomahawk.extend(TomahawkResolver,
{
	settings:
	{
		name: 'YouTube',
		weight: 50,
		timeout: 5,
		maxResults: 2
	},
	process: function (qid, videoPageUrl, result) {
		var q = 'http://www.youtube-mp3.org/api/pushItem/?item='+encodeURIComponent(videoPageUrl)+'&xy=true';
		var videoId = Tomahawk.syncRequest(q);
		if(videoId && videoId !== '$$$LIMIT$$$' ) {
			var qPoll = 'http://www.youtube-mp3.org/api/itemInfo/?video_id=' + videoId;		
			var count = 0;
			var pushItemYTError = function() { //defined in return string
				//Tomahawk.log("Youtube Error");
			};
			var poll = function() {
				if(count > 24) //max 2 minutes
					return;
				var ret = Tomahawk.syncRequest(qPoll);
				if(ret == '$$$ERROR$$$')
					return;
				else {
					eval(ret); // define var info
					if('undefined' === info)
						return;
					if(info['status'] == 'captcha')
						return;
					if (info['status'] !== 'serving') {
						count++;
						setTimeout(argument.callee, 5000);
					} else {
						result.url = 'http://www.youtube-mp3.org/get?video_id=' + videoId + '&h=' + info['h'];
						var results = [result];
						var return1 =  {
							qid: qid,
							results: results
						};
						Tomahawk.addTrackResults(return1);
					}
				}	
			} //poll
			poll();
		}
		else {
			//Tomahawk.log('$$$LIMIT$$$');
		}
	},
	resolve: function( qid, artist, album, title )
	{	
		if(artist !== "" ) {
		  query = encodeURIComponent(artist) + "+";
		}
		if(title !== "" ) {
		  query += encodeURIComponent(title);
		}
		var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q="+ query + "&v=2&alt=jsonc&max-results=" + this.settings.maxResults;
		apiQuery = apiQuery.replace(/\%20/g,'\+');
		
		var myJsonObject = {};
		var results = new Array();
		// send request and parse it into javascript
	    var jsonString = Tomahawk.syncRequest(apiQuery);
	    
	    if(jsonString) {
	    	myJsonObject = JSON.parse(jsonString);
	    	if (myJsonObject.data.totalItems > 0){
		  		for (i=0;i<myJsonObject.data.totalItems && i < this.settings.maxResults; i++){
		    		var item = myJsonObject.data.items[i];
		    		if ( item  !== 'undefined') {
		    			if (item.status && item.status['value'] == 'restricted')
		    				continue;
					 	var result = new Object();
		        		result.artist = artist;
		        		result.track = title;
		        		result.album = album;
		        		result.source = this.settings.name;
		        		result.mimetype = "audio/mp3";
		        		result.bitrate = 128;
		        		result.duration = item.duration;
		        		result.score = 1.00;
		        		this.process(qid, item.player['default'], result);
			    	}
		    	}
		  	}	
	    }
	},
	search: function( qid, searchString )
	{
		var return1 =  {
			qid: qid,
			results: new Array()
		};
		return return1;	
	}
});

Tomahawk.resolver.instance = YouTubeResolver;