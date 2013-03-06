/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2012, mack-t <no_register_no_volatile@ymail.com>
 *   Copyright 2012, Peter Loron <peterl@standingwave.org>
 *   Copyright 2013, Teo Mrnjavac <teo@kde.org>
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


Tomahawk.log(" Music Manager begining");

var musicManager = {

    dbName : "GoogleDriveDB" ,
    dbSQL: null ,
    searchLimitResults : 500 ,
  
    initDatabase : function() 
    {
		// TODO : choose the id : url / device ID / combo of columns ? 
      Tomahawk.log("Init webSQL Db : ");
      if (!this.dbSQL) this.dbSQL = openDatabase(this.dbName, '1.0', 'Muic Database', 2 * 1024 * 1024) ;
      this.dbSQL.transaction(function (tx) {
                        tx.executeSql('CREATE TABLE IF NOT EXISTS track (id primary key, title, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url)');
                    });
     },
     
     showDatabase: function()
     {
		 Tomahawk.log("Displaying Content of Database");
		 this.dbSQL.transaction(function (tx) {
			  tx.executeSql('SELECT * FROM track', [],  function (tx, resultsQuery ) {
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					var len = results.length ; var i = 0 ;
					for (i ; i < len ; i ++) {						
						Tomahawk.log("id:"+results[i].id+", title:"+results[i].title+", artist:"+results[i].artist+", album:"+results[i].album+", url:"+results[i].url+"");
					}
               });
        });
	 },
     
    // delete the database
    flushDatabase : function()
    {
        this.dbSQL.transaction(function (tx) {
            tx.executeSql('DROP TABLE track');
        });
        musicManager.initDatabase() ;
        Tomahawk.log("webSQL db cleaned out");
    },
	
    addTrack : function(tabTrackDetails)
    {
	  var id = tabTrackDetails["id"];
      var title = tabTrackDetails["title"];
      var artist = tabTrackDetails["artist"];
      var album = tabTrackDetails["album"] ;
      var albumpos = tabTrackDetails["albumpos"];
      var year = tabTrackDetails["year"] ;
      var genre = tabTrackDetails["genre"] ;
      var size = tabTrackDetails["size"] ;
      var duration = tabTrackDetails["duration"] ;
      var mimetype = tabTrackDetails["mimetype"] ;
      var bitrate = tabTrackDetails["bitrate"] ;
      var url = tabTrackDetails["url"] ;
           
      // Check presence in the database before adding
      if (id == "" || !id) { Tomahawk.log("Insertion intented without an id key");  return ; }
      this.dbSQL.transaction(function (tx) {
          tx.executeSql('SELECT id FROM track where id=?', [id], function (tx, resultsQuery ) {
			  if (resultsQuery.rows.length > 0) {
				  Tomahawk.log("Insertion abort : data already inside the "+this.dbName+"");
				  return ;
			  }
		  });        
      });
      // Track Insertion
      this.dbSQL.transaction(function (tx) {
          tx.executeSql('INSERT INTO track (id, title, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, title, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url]);
      });
      Tomahawk.log("Insertion inside "+this.dbName+"");
    },

    deleteTrack: function (tabTrackDetails)
    {
		if (id == "" || !id) { Tomahawk.log("Deletion intented without an id key");  return ; }
        this.dbSQL.transaction(function (tx) {
			//tx.executeSql('DELETE FROM track (title, artist, album, url) VALUES (?, ?, ?, ?)', [tabTrackDetails["title"], tabTrackDetails["artist"], tabTrackDetails["album"] , tabTrackDetails["url"]]);
			tx.executeSql('DELETE FROM track WHERE id = ?', [tabTrackDetails["id"]], function (tx,resultsQuery){}); 
        });       
        Tomahawk.log("Deletion inside "+this.dbName+"");
    },


    parseSongAttriutes: function (resultsQuery)
    {
		//Tomahawk.log("parsing Attribute");
        var results = [] ; var song ;
        var len = resultsQuery.rows.length
        for (i = 0; i < len; i++) {
			song = {
				id: resultsQuery.rows.item(i).id ,             
				title: resultsQuery.rows.item(i).title ,
				artist: resultsQuery.rows.item(i).artist ,
				album: resultsQuery.rows.item(i).album ,
				albumpos: resultsQuery.rows.item(i).albumpos ,
				year: resultsQuery.rows.item(i).year ,
				genre: resultsQuery.rows.item(i).genre ,
				size: resultsQuery.rows.item(i).size ,
				duration: resultsQuery.rows.item(i).duration ,
				mimetype: resultsQuery.rows.item(i).mimetype ,
				bitrate: resultsQuery.rows.item(i).bitrate,
				url: resultsQuery.rows.item(i).url ,
			};
			results.push(song) ;
        }
        return results ;
    },

    // Return all the artists
    allArtistsQuery : function(callBack)
    {
      var results = []; 
      this.dbSQL.transaction(function (tx) {
		tx.executeSql('SELECT DISTINCT artist FROM track', [], function (tx, resultsQuery ) {
				var len = resultsQuery.rows.length, i;
				Tomahawk.log("Number of artists results : "+ len);
				for (i = 0; i < len; i++) {
					results.push(resultsQuery.rows.item(i).artist) ;                
				}
				callBack(results);
		});
      });
    },

    // return all the albums name for this artist
    albumsQuery: function(artist,callBack)
    {
		var results = [] ;
		this.dbSQL.transaction(function (tx) {
		tx.executeSql('SELECT DISTINCT album FROM track WHERE artist=?', [artist], function (tx, resultsQuery ) {
				var len = resultsQuery.rows.length, i;
				//Tomahawk.log("Number of albums results : "+ len);
					for (i = 0; i < len; i++) {
						results.push (resultsQuery.rows.item(i).album) ;
					}
				callBack(results);
		});
      });
    },
    
    // return all the tracks of this artist' album
    tracksQuery: function(artist , album, callBack)
    {
        this.dbSQL.transaction(function (tx) {
            tx.executeSql('SELECT * FROM track WHERE artist=? and album=?', [artist,album],  	
                function (tx, resultsQuery ) {
                    var results = musicManager.parseSongAttriutes(resultsQuery) ;
                    //Tomahawk.log("Number of results : "+results.length);
                    callBack(results) ;
                });
        });
    },

    // Parse Title, Album , Artist
    searchQuery: function (searchString,callBack)
    {
		this.dbSQL.transaction(function (tx) {							
			  // Select first or limit mechanisim ? 		  			  
			  tx.executeSql("SELECT * FROM track WHERE (album LIKE ?) or (artist LIKE ?) or (title LIKE ?)", ["%"+searchString+"%","%"+searchString+"%","%"+searchString+"%"],
				function (tx, resultsQuery ) {
					var len = resultsQuery.rows.length, i;					
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					//Tomahawk.log("Number of track results for query : "+results.length);                  
                    callBack(results) ;
               });
        });
    },

    // Only one Track matching
    resolve: function(artist, album, title, callBack)
    {    
		var results = [] ;
        this.dbSQL.transaction(function (tx) {
			  tx.executeSql('SELECT * FROM track WHERE album=? and artist=? and title=? ', [album,artist,title],  // Select first or limit mechanisim ? 		  			  
				function (tx, resultsQuery ) {
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					//Tomahawk.log("Number of track results for resolve : "+results.length);
                    // Filter to give only ONE row 
                    callBack(results[0]) ;
                });
        });
    },
};

 // Testing Object
 var musicManagerTester = {  
	tabTrackDetails: [] , 
	
	init: function() {
		this.tabTrackDetails = {"id":"22" , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };		
	},
	
	populateDatabase: function (rows){
		musicManager.flushDatabase() ;
		var  i = 0 ;
		for (i ; i < rows ; i++) {
			for (index in this.tabTrackDetails){
				this.tabTrackDetails[index] = index+i ;
			}
			musicManager.addTrack(this.tabTrackDetails) ;
		}		
	},
	
	showDatabase: function() {
		musicManager.showDatabase() ;
	},
	
	addTrackTest: function (){
		musicManager.addTrack(this.tabTrackDetails) ;
	},
	
	deleteTrackTest: function() {
		musicManager.deleteTrack(this.tabTrackDetails) ;
	},
	
	flushDatabaseTest: function() {
		musicManager.flushDatabase() ;
	},
	
	resolveTest: function() {
		var artist = this.tabTrackDetails["artist"];
		var album = this.tabTrackDetails["album"];
		var title = this.tabTrackDetails["title"];
		musicManager.resolve(artist,album,title, function(results){
				Tomahawk.log("Return songs title "+results.title);		
		});
	},
		
	allArtistsQueryTest: function() {
		musicManager.allArtistsQuery(function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				Tomahawk.log("Return artist name num "+i+" : "+results[i]);		 
			}
		});
	},
	
	tracksQueryTest: function() {
		var artist = this.tabTrackDetails["artist"];
		var album = this.tabTrackDetails["album"];
		
		musicManager.tracksQuery(artist, album , function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				Tomahawk.log("Return track title name num "+i+" : "+results[i].title);		 
			}
		});
	},
	
	albumsQueryTest: function() {
		var artist = this.tabTrackDetails["artist"];
		musicManager.albumsQuery(artist, function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				Tomahawk.log("Return album title name num "+i+" : "+results[i]);		 
			}
		});
	},
	
	searchQueryTest: function() {
		var qString = "art";
		musicManager.searchQuery(qString, function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				//Tomahawk.log("Return of a search query size : "+i+" : "+results[i]);	 
			}
		});
	},	

/*	
	// Test Scenario 
	insertionDuplicateTest() {		
		this.tabTrackDetails = {"id":"22" , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		var test = this.tabTrackDetails ;
		musicManager.addTrack(test) ;
		//musicManager.addTrack(this.tabTrackDetails) ;
	},

	insertionWithoutKeyTest() {		
		this.tabTrackDetails = {"id":"" , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ;
		this.tabTrackDetails = {"id":null , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ;
	},
	
	deletionWithoutKeyTest() {
		this.tabTrackDetails = {"id":"" , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.deleteTrack(this.tabTrackDetails) ;
		this.tabTrackDetails = {"id":null , "title": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.deleteTrack(this.tabTrackDetails) ;		
	},
* */
	
};
