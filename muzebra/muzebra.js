
RegExp.prototype.execAll = function(string) {
    var match = null;
    var matches = new Array();
    while (match = this.exec(string)) {
        var matchArray = [];
        for (i in match) {
            if (parseInt(i) == i) {
                matchArray.push(match[i]);
            }
        }
        matches.push(matchArray);
    }
    return matches;
}

var MuzebraResolver = Tomahawk.extend(TomahawkResolver,
{
    
    asyncRequest: function(url, method, success) {
	var r = new XMLHttpRequest();
	
        var headers = {
            "Accept" : "application/json, text/javascript, */*; q=0.01",
            "Accept-Language" : "de-de,de;q=0.8,en-us;q=0.5,en;q=0.3",
            "Accept-Charset" : "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
            "DNT" : "1",
            "Host" : "muzebra.com",
            "Origin" : "http://muzebra.com",
            "Referer" : "http://muzebra.com/",
            "User-Agent" : "Mozilla/5.0 (X11; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0",
            "X-Requested-With" : "XMLHttpRequest"
        }

	r.open(method, url, true);
        
        for(var i in headers) {
            r.setRequestHeader(i, headers[i]);
        }

	r.onreadystatechange = function() {
	    if(r.readyState == 4 &&
	       r.status == 200) {
		success(r);
	    } else if(r.readyState == 4) {
		Tomahawk.log("asyncRequest error " + r.status);
	    }
	}

	r.send(null);
    },

    settings: {
	name: 'Muzebra resolver'
    },

    resolve: function(qid, artist, album, title) {
	return Tomahawk.addTrackResults(this.internalSearch(qid));
    },

    search: function(qid, searchString) {        
        var that = this;
        this.results = [];
        
        this.asyncRequest('http://muzebra.com/service/playerparams/', 'POST', function(xhr) {
            var key = JSON.parse(xhr.responseText).hash + '/';

            that.asyncRequest(
                'http://muzebra.com/search/?q=' + searchString, 
                'GET', 
                function(xhr) {
                    var content = JSON.parse(xhr.responseText).content;

                    var artists = /<a href=".+" class="hash artist".+?>(.+?)<\/a>/g.execAll(content);
                    var tracks = /<span itemprop="name" class="name">(.+?)<\/span>/g.execAll(content);
                    var durations = /<a class="info"  data-aid=".+" data-link=".+" data-current="0" data-duration="([0-9]+)">/g.execAll(content);
                    var dataids = /<a class="info"  data-aid=".+" data-link="(.+?)"/g.execAll(content);

                    for(var i = 0; i < artists.length; i++) {
                        var res = {};
                        
                        res.artist = artists[i][1];
                        res.duration = durations[i][1];
                        res.track = tracks[i][1];
                        res.url = 'http://savestreaming.com/t/' + dataids[i][1] + '_' + key;
                        Tomahawk.log(res.url);

                        that.results[i] = res;
                    }
                    
	            Tomahawk.addTrackResults(that.internalSearch(qid));
	        });
        });


    },
    
    results: [],

    internalSearch: function(qid) {
	return {
	    qid: qid,
	    results: this.results
	}
    },
    
});

Tomahawk.resolver.instance = MuzebraResolver;