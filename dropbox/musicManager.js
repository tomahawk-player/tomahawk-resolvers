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

    initDatabase : function(userAccountParameters)
    {
      // get db infos 
      parse = JSON.parse(userAccountParameters) ;
      var token = parse.token ; 
      var username = parse.username;
      
      var db = openDatabase(username, '1.0', 'DropBox Muic Database', 2 * 1024 * 1024);
      //  tx.executeSql('CREATE TABLE IF NOT EXISTS track (id integer primary key autoincrement, title , artist, album, year, genre, url)');
      db.transaction(function (transaction) {
	transaction.executeSql("CREATE TABLE IF NOT EXISTS track ("  + 
	  "title VARCHAR(20) NOT NULL ," + 
	  "artist VARCHAR(20) NOT NULL ,"+
	  "album VARCHAR(20) NOT NULL ,"+
	  "year VARCHAR(4) , "+
	  "genre VARCHAR(15) ,"+
	  "url VARCHAR(50) NOT NULL ,");
      });
	
	db.transaction(function (tx) {
	  tx.executeSql('CREATE TABLE IF NOT EXISTS dbinfo (token primary key, username )');
	});
	
    },
    
    // delete the database ( token & username required ) 
    deleteDatabase : function(userAccountParameters)
    {
        // TODO : erase dbinfo table ??
    },
	
    
    // Database content management 
 
    addTrack : function(JsonTrackDetails)
    {
      parse = JSON.parse(JsonTrackDetails) ;
      var title = parse.title ;
      var artists = parse.arist ; var concatartists ;
      var albums = parse.album ;  var concatalbums ;
      var years = parse.year ;    var concatyears ;
      var genres = parse.genre ;  var concatgenres ; 
      var url = parse.url ;
      
      // Checking presence in the database before adding
       // TODO : request :) 
      
      // Multiple artist 
      if (artists.length > 1) {
	var len = artists.length ;
	for (var i = 0; i < len; i++) {
	  concatartists = artists[i].artist.trim().toLowerCase() + ";" 
	}
	artists = concatartists ; 
      }
    
      // Miltiple Album
      if (albums.length > 1) {
	var len = albums.length ;
	for (var i = 0; i < len; i++) {
	  concatalbums += albums[i].album.trim().toLowerCase() + ";" 
	}
	albums = concatalbums ; 
      }
      //Multiple Year
      if (years.length > 1) {
	var len = years.length
	for (var i = 0; i < len; i++) {
	  concatyears += years[i].year.trim().toLowerCase() + ";"
	}
	  years = concatyears ;
      }
      
      //Multiple genre
      if (var genres.length > 1) {
	var len = genres.length ;
	for (var i = 0; i < len; i++) {
	  concatgenres += genres[i].genre.trim().toLowerCase() + ";"
	}
	  genres = concatgenres ;
      }
      
	// Track Insertion
	db.transaction(function (tx) {
	  tx.executeSql('INSERT INTO track (title, artist, album, year, genre, url) VALUES (?, ?, ?, ?, ?, ?)', 
			[title, artists, albums, years, genres, url]);
	});
    },


    artistRequest : function(artist)
    {
      artist = artist.trim().toLowerCase() ; 
      db.transaction(function (tx) {
	tx.executeSql('SELECT album FROM track WHERE artist LIKE % "'+ artist+ '"%' , [], function (tx, results ) {  
	  // check :  results.rows.length, i;
	  // TODO : if the track with the required artist has severals album : explode on the ";"
	  // TODO : create a Json as return or string : check script Collection needs ?! 
	});
      });
    },
    
    // search for the artist' album
    albumRequest : function()
    {
      
        
    },
    
    // search for the artist 
    trackRequest : function()
    {
      
	
    },