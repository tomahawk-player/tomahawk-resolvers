/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2015, grosbouff
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */


var drieVoorTwaalfResolver = Tomahawk.extend(TomahawkResolver, {

	// Basic settings
    settings:
    {
        name:       '3voor12',
        icon:       '3voor12-icon.png',
        weight:     70,
        timeout:    8
    },
    
    // 3voor12
    service:
    {
    	website:	"http://3voor12.vpro.nl",
    	collection:	"http://3voor12.vpro.nl/mobiel/luisterpaal/iphone/",
    	api:{
    		endpoint: "http://rs.vpro.nl/v3/api"
    	}
    },

    
    init: function() {

        Tomahawk.addCustomUrlHandler( '3voor12', 'getStreamUrl', true );

        var that = this;
        
        that._getData(function (response) {
            if (response) {
                that.trackCount = response.length;
                Tomahawk.log("[3voor12] Reporting collection with " + that.trackCount + " tracks");
                Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
            }
        });
        
        this._ready = true;
    },

    _convertAlbum: function (entry) {
        return {
            artist:     entry.artist,
            album:      entry.album,
            year:       entry.year
        };
    },

    _convertArtist: function (entry) {
        return entry.artist;
    },
    
    _waitingCallbacks: [],

    _isRequesting: false,

    _callAllWaitingCallbacks: function () {
        while (this._waitingCallbacks.length > 0) {
            this._waitingCallbacks.splice(0, 1)[0](this.cachedRequest.response);
        }
        this._isRequesting = false;
    },
    
    _getData: function (callback) {

        var that = this;
        var time = Date.now();
        var results = [];
        that._waitingCallbacks.push(callback);
        if (!that._isRequesting) {
            if (!that.cachedRequest
                || that.cachedRequest.time + that.settings.cacheTime * 1000 > Date.now) {
                Tomahawk.log("[3voor12] Checking cache");
                that._isRequesting = true;
                that._getCollection(results, function (results) {
                    if (results && results.length > 0) {
                        Tomahawk.log("[3voor12] Collection needs to be updated");
                        if (that.cachedRequest) {
                            results = that.cachedRequest.response.concat(results);
                        }
                        // Recreate fuzzy index
                        that.cachedRequest = {
                            response: results,
                            time: Date.now()
                        };
                        var indexList = [];
                        for (var idx = 0; idx < that.cachedRequest.response.length; idx++) {
                            var entry = that.cachedRequest.response[ idx ];
                            indexList.push({
                                id: idx,
                                artist: entry.artist,
                                album: entry.album,
                                track: entry.title
                            });
                        }
                        Tomahawk.log("[3voor12] Creating fuzzy index, count: " + indexList.length);
                        Tomahawk.createFuzzyIndex(indexList);
                        Tomahawk.log("[3voor12] Updated cache in " + (Date.now() - time) + "ms");
                    } else {
                        Tomahawk.log("[3voor12] Collection doesn't need to be updated");
                    }
                    that._callAllWaitingCallbacks();
                });
            } else {
                that._callAllWaitingCallbacks();
            }
        }
    },
    
    _getCollection: function (results, callback) {
        
        var that = this;
        
        var extraHeaders = {
            'Content-Type':     'application/xml'
        };
        
        Tomahawk.asyncRequest(that.service.collection, function(request) {
            
                var response = request.responseText;
                //response = JSON.parse(response);
                var tracks = that.parseTrackXML(response);
                
                results = results.concat(tracks);

                Tomahawk.log("[3voor12] Received chunk of tracks, tracks total: " + tracks.length);

            callback(results);


        }, extraHeaders);
        
    },
    
    parseTrackXML : function(response){
        
        var that = this;
        
        var tracks = [];

        var parser=new DOMParser();
        var dom = parser.parseFromString(response,'text/xml');
        var tracks_nodes = dom.getElementsByTagName("track");
        
        for (var track_key in tracks_nodes){

            var track = {};

            var track_node = tracks_nodes[track_key];
            var track_props = track_node.childNodes;

            for (var track_prop_key in track_props){

                var prop_node = track_props[track_prop_key];
                var propName = prop_node.nodeName;
                var propValue = prop_node.textContent;
                if (!propValue) continue;

                // populate track information
                switch(propName) {
                    
                    case 'title':
                        track.title = propValue;
                    break;
                    case 'location':
                        track.url = propValue.replace("odis+http://", "3voor12://"); //swap protocol so we can hook getStreamUrl() (via addCustomUrlHandler)
                    break;
                    case 'duration':
                        track.duration = propValue / 1000;
                    break;
                }

                //add parent album informations
                var album_node = track_node.parentNode.parentNode;
                var album_props = album_node.childNodes;

                for (var album_prop_key in album_props){

                    var prop_node = album_props[album_prop_key];
                    var propName = prop_node.nodeName;
                    var propValue = prop_node.textContent;
                    if (!propValue) continue;

                    switch(propName) {

                        case 'title':
                            track.album = propValue;
                        break;

                        case 'artist':
                            track.artist = propValue;
                        break;

                        case 'image':
                            track.image = propValue;
                        break;

                    }
                }

                for(var propertyName in track) {
                    Tomahawk.log("[3voor12] track "+propertyName+": "+track[propertyName]);//debug
                }


            }


            //add to array
            if ( (track.hasOwnProperty('artist')) && (track.hasOwnProperty('album')) && (track.hasOwnProperty('title')) ) { //security check
                tracks.push(track);
            }

        }
        
        return tracks;
        
    },
    
    /**
    TO CHECK : why is that function ?
    Could not work with only parseTrackXML() ?
    **/
    
   parseSongFromAttributes: function (entry) {

        return {
            artist:     entry.artist,
            album:      entry.album,
            track:      entry.title,
            year:       entry.year,

            albumpos:   entry.trackNumber,
            discnumber: entry.discNumber,

            size:       entry.estimatedSize,
            duration:   entry.duration,

            source:     this.settings.name,
            url:        entry.url,
            checked:    true
        };
    },
    
	getStreamUrl: function (qid, fake_url) {
	
		var url = fake_url.replace("3voor12://", "odis+http://") //bring back the original protocol

        var headers = {
            "Accept" : "application/json, text/javascript, */*; q=0.01",
            "Content-Type" : "text/plain",
            "DNT" : "1",
            "Host" : "rs.vpro.nl",
            "Origin" : "http://3voor12.vpro.nl",
            "Referer" : "http://3voor12.vpro.nl/albums.html"
        };
 
        Tomahawk.asyncRequest(this.service.api.endpoint + "/locations?plainText=true", function (xhr) {
			try {
				var response = JSON.parse(xhr.responseText);
            	Tomahawk.reportStreamUrl(qid, response.programUrl);
            } catch (e) {
            	Tomahawk.log("[3voor12] error with getStreamUrl:"+url);
            }
        }, headers, {
            method: "POST",
            data: url
        });
    },

    
    _execSearchLocker: function (query, callback, max_results, results) {
        var that = this;
        var time = Date.now();
        this._getData(function (response) {
            if (response) {
                if (!results) {
                    results = { tracks: [], albums: [], artists: [] };
                }
                
                Tomahawk.log("[3voor12] 3voor12# _execSearchLocker");

                var resultIds = Tomahawk.searchFuzzyIndex(query);
                for (var idx = 0; idx < resultIds.length; idx++) {
                    var id = resultIds[idx][0];
                    var entry = response[id];
                    var artist = that._convertArtist(entry);
                    var album = that._convertAlbum(entry);
                    if (!that.containsObject(artist, results.artists)) {
                        results.artists.push(artist);
                    }
                    if (!that.containsObject(album, results.albums)) {
                        results.albums.push(album);
                    }
                    results.tracks.push(that.parseSongFromAttributes(entry));
                }
            }
            Tomahawk.log("[3voor12] Searched Locker for " + (Date.now() - time) + "ms and found "
                + results.tracks.length + " tracks");
            callback.call( window, results );
        });
    },

    _execSearchAllAccess: function (query, callback, max_results, results) {
        if (!results) {
            results = { tracks: [], albums: [], artists: [] };
        }
        var that = this;
        var url =  this._baseURL + 'query?q=' + query;
        if (max_results)
            url += '&max-results=' + max_results;

        var time = Date.now();
        Tomahawk.asyncRequest(url, function (request) {
            if (200 != request.status) {
                Tomahawk.log("["+settings.name+"]" + query + "' failed:\n"
                        + request.status + " "
                        + request.statusText.trim() + "\n"
                        + request.responseText.trim()
                );
                return;
            }
            var response = JSON.parse( request.responseText );

            // entries member is missing when there are no results
            if (!response.entries) {
                callback.call( window, results );
                return;
            }

            for (var idx = 0; idx < response.entries.length; idx++) {
                var entry = response.entries[ idx ];
                switch (entry.type) {
                    case '1':
                        var result = that.parseSongFromAttributes( entry.track );
                        results.tracks.push( result );
                        break;
                    case '2':
                        var result = that._convertArtist( entry.artist );
                        if (!that.containsObject(result, results.artists)) {
                            results.artists.push( result );
                        }
                        break;
                    case '3':
                        var result = that._convertAlbum( entry.album );
                        if (!that.containsObject(result, results.albums)) {
                            results.albums.push( result );
                        }
                        break;
                }
            }
            Tomahawk.log("[3voor12] Searched All Access for " + (Date.now() - time) + "ms and found "
                + results.tracks.length + " tracks");
            callback.call( window, results );
        }, {
            'Authorization': 'GoogleLogin auth=' + this._token
        }, {
            method: 'GET'
        });
    },

    _execSearch: function (query, callback, max_results) {
        var that = this;
        var results = { tracks: [], albums: [], artists: [] };
        this._execSearchLocker( query, function (results) {
            if (that._allAccess) {
                that._execSearchAllAccess( query, function (results) {
                    callback.call( window, results );
                }, max_results, results);
            } else {
                callback.call( window, results );
            }
        }, max_results, results);
    },

    search: function (qid, query) {
        if (!this._ready) return;

        this._execSearch( query, function (results) {
            Tomahawk.addTrackResults(
                { 'qid': qid, 'results': results.tracks } );
            Tomahawk.addAlbumResults(
                { 'qid': qid, 'results': results.albums } );
            Tomahawk.addArtistResults(
                { 'qid': qid, 'results': results.artists } );
        }, 20);
    },

    _resolveAllAccess: function(qid, artist, album, title) {
        if (this._allAccess) {
            // Format the search as track-artists-album for now
            var query = artist;
            if (album) {
                query += ' - ' + album;
            }
            query += ' - ' + title;
            Tomahawk.log("[3voor12] " + query);
            this._execSearchAllAccess(query, function (results) {
                if (results.tracks.length > 0) {
                    Tomahawk.addTrackResults({
                        'qid': qid,
                        'results': [
                            results.tracks[0]
                        ]
                    });
                } else {
                    // no matches, don't wait for the timeout
                    Tomahawk.addTrackResults({ 'qid': qid, 'results': [] });
                }
            }, 1);
        } else {
            Tomahawk.addTrackResults({ 'qid': qid, 'results': [] });
        }
    },

    resolve: function (qid, artist, album, title) {
        var that = this;
        if (!this._ready) return;

        // Ensure that the recent data was loaded
        this._getData(function (response) {
            var time = Date.now();
            var resultIds = Tomahawk.resolveFromFuzzyIndex(artist, album, title);
            
            Tomahawk.log("[3voor12] resolve");
            
            if (resultIds.length > 0) {
                Tomahawk.addTrackResults({
                    'qid': qid,
                    'results': [
                        that.parseSongFromAttributes(response[resultIds[0][0]])
                    ]
                });
            } else {
                that._resolveAllAccess(qid, artist, album, title);
            }
            Tomahawk.log("[3voor12] Resolved Locker for " + (Date.now() - time) + "ms and found "
                + resultIds.length.length + " tracks");
        });
    },


    containsObject: function (obj, list) {
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] === obj) {
                return true;
            }
        }

        return false;
    },


    // Script Collection Support

    artists: function (qid) {

        this._getData(function (response) {

            var names = response.map(function (item) {
                return item.artist;
            });            
            var unique_names = names.filter(function (item, pos) {
                return names.indexOf(item) == pos;
            });

            Tomahawk.addArtistResults({
                qid: qid,
                artists: unique_names
            });
        });
    },

    albums: function (qid, artist) {

        this._getData(function (response) {
            
            var names = response.filter(function (item) {
                return item.artist == artist;
            }).map(function (item) {
                return item.album;
            });
            var unique_names = names.filter(function (item, pos) {
                return names.indexOf(item) == pos;
            });

            Tomahawk.addAlbumResults({
                qid: qid,
                artist: artist,
                albums: unique_names
            });
        });
    },

    tracks: function (qid, artist, album) {

        var that = this;
        this._getData(function (response) {
            var tracks = response.filter(function (item) {
                return item.artist == artist && item.album == album;
            }).map(function (item) {
                return that.parseSongFromAttributes(item);
            });

            Tomahawk.addAlbumTrackResults({
                qid: qid,
                artist: artist,
                album: album,
                results: tracks
            });
        });
    },

    collection: function()
    {
        return {
            prettyname: this.settings.name,
            description: this.service.website,
            iconfile: this.settings.icon,
            trackcount: this.trackCount
        };
    }
});

Tomahawk.resolver.instance = drieVoorTwaalfResolver;
