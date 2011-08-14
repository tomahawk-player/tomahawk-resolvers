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
		process: function (videoPageUrl) {
		var q = 'http://www.youtube-mp3.org/api/pushItem/?item='+encodeURIComponent(videoPageUrl)+'&xy=true';
		var videoId = Tomahawk.syncRequest(q);
		if(videoId && videoId !== '$$$LIMIT$$$' ) {
			var qPoll = 'http://www.youtube-mp3.org/api/itemInfo/?video_id=' + videoId;
			var mp3Url;
			var pushItemYTError = function() {
				Tomahawk.log("Youtube Error");
			};
			var poll = function() {
					var ret = Tomahawk.syncRequest(qPoll);
					if(ret == '$$$ERROR$$$')
						return false;
					else {
						eval(ret); // define var info
						if(info === 'undefined')
							return false;
						if(info['status'] == 'captcha')
							return false;
						if (info['status'] !== 'serving') {
							return true;
						} else {
							mp3Url =  'http://www.youtube-mp3.org/get?video_id=' + videoId + '&h=' + info['h'];
							return false;
						}
					}
				
			}
			var sleep = function(time) {
				var ret = Tomahawk.syncRequest('http://lasconic.com/public/sleep.php?ms=' + time);
			}
			
			while(poll()){
				sleep(5000);
			}
			return mp3Url;
		}
		else{
			return 'undefined';
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
			    		var url = this.process(item.player['default']);
			    		if (url !== 'undefined') {
			    			Tomahawk.log("found :" + title + " - " + artist + ": " + url);
			        		var result = new Object();
			        		result.artist = artist;
			        		result.track = title;
			        		//result.year = ;
			        		result.source = this.settings.name;
			        		result.url = url;
			        		result.mimetype = "audio/mp3";
			        		//result.extension = "mp3";
			        		result.bitrate = 128;
			        		result.duration = item.duration;
			        		result.score = 1.00;
			        		results.push(result);
			    		}
		    		}
		  		}	
	    	}
	    }

       	var return1 =  {
			qid: qid,
			results: results
		};
		return return1;
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