/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2013, Franck Arrecot <franck.arrecot@gmail.com>
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

    dbName : "MyDropBoxDB" ,
    dbSQL: null ,
    searchLimitResults : 500 ,
  
  
    initDatabase : function() 
    {
      Tomahawk.log("Init webSQL Db : ");
      if (!this.dbSQL) this.dbSQL = openDatabase(this.dbName, '1.0', 'Muic Database', 2 * 1024 * 1024) ;
      this.dbSQL.transaction(function (tx) {
			tx.executeSql('CREATE TABLE IF NOT EXISTS track (id primary key, track, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url)');
      });
     },
     
     showDatabase: function()
     {
		 Tomahawk.log("Displaying Content of Database"); var log = "" ;
		 this.dbSQL.transaction(function (tx) {
			  tx.executeSql('SELECT * FROM track', [],  function (tx, resultsQuery ) {
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					// Parsing to display information on each music 
					var len = results.length ; var i = 0 ;
					for (i ; i < len ; i ++) {
						for (row in results[i]) {
							log += ""+row+": "+ results[i][row] +"," ;
						}
						Tomahawk.log (log) ;				
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
	  var id = tabTrackDetails["id"] || '';
      var track = tabTrackDetails["track"] || '';
      var artist = tabTrackDetails["artist"] || '';
      var album = tabTrackDetails["album"] || '';
      var albumpos = tabTrackDetails["albumpos"] || '';
      var year = tabTrackDetails["year"] || '';
      var genre = tabTrackDetails["genre"] || '' ;
      var size = tabTrackDetails["size"] || '' ;
      var duration = tabTrackDetails["duration"] || '' ;
      var mimetype = tabTrackDetails["mimetype"] || '' ;
      var bitrate = tabTrackDetails["bitrate"] || '' ;
      var url = tabTrackDetails["url"] || '' ;
     
      // check core information provided
      if (id == "" || track == "" || album=="" || artist =="" || url=="") {
		  Tomahawk.log("Insertion Failed : core information track isn't provided to "+this.dbName);
		  return ;
	  }
	  else 
	  {
		  // Check presence in the database before adding
		  var db = this.dbName ;
		  this.dbSQL.transaction(function (tx) {
			  tx.executeSql('SELECT id FROM track where id=?', [id], function (tx, resultsQuery ) {
				  if (resultsQuery.rows.length > 0) {
					  Tomahawk.log("Insertion abort : data already inside the "+db+"");
					  return ;
				  }
			  });        
		  });
      }
      // Track Insertion
      this.dbSQL.transaction(function (tx) {
          tx.executeSql('INSERT INTO track (id, track, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, track, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url]);
      });
      Tomahawk.log("Insertion inside "+this.dbName+"");
    },

    deleteTrack: function (tabTrackDetails)
    {
		var id = tabTrackDetails["id"] || '';
		if (id == "" || !id) { Tomahawk.log("Deletion intented without an id key");  return ; }
        this.dbSQL.transaction(function (tx) {
			tx.executeSql('DELETE FROM track WHERE id = ?', [id], function (tx,resultsQuery){}); 
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
				track: resultsQuery.rows.item(i).track ,
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
                    Tomahawk.log("Number of results : "+results.length+ "  "+ DumpObjectIndented(results));                    
                    callBack(results) ;
                });
        });
    },

    // Parse track, Album , Artist
    searchQuery: function (searchString,callBack)
    {
		this.dbSQL.transaction(function (tx) {							
			  // Select first or limit mechanisim ? 		  			  
			  tx.executeSql("SELECT * FROM track WHERE (album LIKE ?) or (artist LIKE ?) or (track LIKE ?)", ["%"+searchString+"%","%"+searchString+"%","%"+searchString+"%"],
				function (tx, resultsQuery ) {
					var len = resultsQuery.rows.length, i;					
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					//Tomahawk.log("Number of track results for query : "+results.length);                  
                    callBack(results) ;
               });
        });
    },

    // Only one Track matching
    resolve: function(artist, album, track, callBack)
    {    
		var results = [] ;
        this.dbSQL.transaction(function (tx) {
			  tx.executeSql('SELECT * FROM track WHERE album=? and artist=? and track=? ', [album,artist,track],  // Select first or limit mechanisim ? 		  			  
				function (tx, resultsQuery ) {
					var results = musicManager.parseSongAttriutes(resultsQuery) ; 
					//Tomahawk.log("Number of track results for resolve : "+results.length);
                    // Filter to give only ONE row : improvement possible : set up a limit ( even if tomahawk is already doing it )
                    callBack(results[0]) ;
                });
        });
    },
};

 // Testing Object
 var musicManagerTester = {  
	tabTrackDetails: [] , 
	
	init: function() {
		this.tabTrackDetails = {"id":"22" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };		
		//musicManager.addTrack(this.tabTrackDetails) ; 
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
	
	flushDatabaseAndWaitTest: function() {
		musicManager.dbSQL.transaction(function (tx) {
            tx.executeSql('DROP TABLE track');
        });
        musicManager.initDatabase() ;
        Tomahawk.log("webSQL db cleaned out");
		return true ;
	},
	
	resolveTest: function() {
		var artist = this.tabTrackDetails["artist"];
		var album = this.tabTrackDetails["album"];
		var track = this.tabTrackDetails["track"];
		musicManager.resolve(artist,album,track, function(results){
				Tomahawk.log("Return songs track "+results.track);		
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
				Tomahawk.log("Return track track name num "+i+" : "+results[i].track);		 
			}
		});
	},
	
	albumsQueryTest: function() {
		var artist = this.tabTrackDetails["artist"];
		musicManager.albumsQuery(artist, function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				Tomahawk.log("Return album track name num "+i+" : "+results[i]);		 
			}
		});
	},
	
	searchQueryTest: function() {
		var qString = "art";
		musicManager.searchQuery(qString, function(results){
			var len = results.length ;  var i = 0;
			for (i  ; i < len ; i++) {
				Tomahawk.log("Return of a search query size : "+i+" : "+results[i]);	 
			}
		});
	},	

	// Test Scenario 
	insertionDuplicateTest:function() {	
		Tomahawk.log("Test Scenario : duplicate insertion");		 	
		this.tabTrackDetails = {"id":"22" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ; // should log a duplicate error
		musicManager.addTrack(this.tabTrackDetails) ;
	},


	insertionWithoutCoreTest:function() {		
		this.tabTrackDetails = {"id":"" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ; // should log a core unprovided error
		this.tabTrackDetails = {"id":null , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ; // should log a core unprovided error
	},
	
	deletionWithoutKeyTest:function() {
		this.tabTrackDetails = {"id":"" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.deleteTrack(this.tabTrackDetails) ;
		this.tabTrackDetails = {"track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "Divin" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.deleteTrack(this.tabTrackDetails) ;		
	},
	
	retrieveRowEmptyGenreTest:function() {
		
		this.tabTrackDetails = {"id":"23" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","genre": "" ,"size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ;
		
		this.tabTrackDetails = {"id":"24" , "track": "Division Bell", "artist": "PinkFloyd", "album": "Division Bell", "albumpos": "Track1" ,"year": "1980","size": "3000","duration":"3:06","mimetype":"flac","bitrate":"256mps","url":"www.pinkFloyd.com/DivisionBell" };			
		musicManager.addTrack(this.tabTrackDetails) ;

		var qString = "Division" ; var log ;
		musicManager.searchQuery(qString, function(results){			
			var len = results.length ;  var i = 0;
			for (i ; i < len ; i++) {
				for (row in results[i]){
					log += ""+row+": "+ results[i][row] +"," ;
				}
			}	
			Tomahawk.log(log);				
		});
	},
};

