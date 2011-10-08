/*
 * (c) 2011 lasconic <lasconic@gmail.com>
 */
var ExfmResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'Ex.fm',
        weight: 30,
        timeout: 5,
        strictMatch: true
    },
    resolve: function (qid, artist, album, title) {
        var valueForSubNode = function (node, tag) {
                return node.getElementsByTagName(tag)[0].textContent;
            };

        // build query to 4shared
        var url = "http://ex.fm/api/v3/song/search/";
        var request = "";
        if (title !== "") request += title;

        //if (artist !== "") request += artist + " ";

        url += encodeURIComponent(request)

        url += "?start=0&result=20";
        Tomahawk.log(url);
        // send request and parse it into javascript
        var that = this;
        var xmlString = Tomahawk.asyncRequest(url, function(xhr) {
            // parse json
            var jsonString = xhr.responseText;
            var ret = JSON.parse(jsonString);

            var results = new Array();
                     Tomahawk.log(ret['results'] + ' - ' + ret['status_code'] + ' - ' + ret['songs']); 
            // check the response
            if (ret['status_code'] == "200" && ret['songs'].length > 0) {
                var songs = ret['songs'];

                // walk through the results and store it in 'results'
                for (var i = 0; i < songs.length; i++) {
                    var song = songs[i];
                    var result = new Object();
                    
                    var dArtist = song['artist'];
                    var dTitle = song['title'];
                    var dAlbum = song['album'];      
                    Tomahawk.log(dArtist + ' - ' + dTitle + ' - ' + dAlbum);            
                    if (!that.settings.strictMatch || (dTitle && dTitle.toLowerCase().indexOf(title.toLowerCase()) !== -1 && dArtist && dArtist.toLowerCase().indexOf(artist.toLowerCase()) !== -1)) {
	                    result.artist = ((dArtist!='')? dArtist:artist);
	                    result.album = ((dAlbum!='')? dAlbum:album);
	                    result.track = ((dTitle!='')? dTitle:title);
	
	                    result.source = that.settings.name;
	                    result.url = song['url'];
	
	                    result.extension = "mp3";
	                    result.bitrate = 128;
	                    result.score = 0.80;
	                    results.push(result);
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
		this.settings.strictMatch = true;
    }
});

Tomahawk.resolver.instance = ExfmResolver;