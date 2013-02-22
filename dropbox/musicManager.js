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


    dbName : "MyDropBoxDB" ,
    dbSQL: null ,//openDatabase(this.dbName, '1.0', 'DropBox Muic Database', 2 * 1024 * 1024) ,
    searchLimitResults : 500 ,



    initDatabase : function()
    {
     Tomahawk.log("Sending Delta Query : ");
      this.dbSQL = openDatabase(this.dbName, '1.0', 'DropBox Muic Database', 2 * 1024 * 1024);
      this.dbSQL.transaction(function (tx) {
                        tx.executeSql('CREATE TABLE IF NOT EXISTS track (id integer primary key autoincrement, title, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url)');
                    });
     },
  
    // delete the database
    flushDatabase : function()
    {
        this.dbSQL.transaction(function (tx) {
            tx.executeSql('DROP TABLE track');
        });
    },
	
    addTrack : function(tabTrackDetails)
    {
      var title = tabTrackDetails["title"].trim().toLowerCase()   ;
      var artist = tabTrackDetails["artist"].trim().toLowerCase() ;
      var album = tabTrackDetails["album"].trim().toLowerCase()   ;
      var albumpos = tabTrackDetails["albumpos"].trim().toLowerCase() ;
      var year = tabTrackDetails["year"] ;
      var genre = tabTrackDetails["genre"] ;
      var size = tabTrackDetails["size"] ;
      var duration = tabTrackDetails["duration"] ;
      var mimetype = tabTrackDetails["mimetype"] ;
      var bitrate = tabTrackDetails["bitrate"] ;
      var url = tabTrackDetails["url"] ;
      
        // Checking presence in the database before adding
       // TODO : request :) 

        // Track Insertion
      this.dbSQL.transaction(function (tx) {
          tx.executeSql('INSERT INTO track (title, artist, album, albumpos, year, genre, size, duration, mimetype, bitrate, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [title, artists, albums, albumpos, year, genre, size, duration, mimetype, bitrate, url]);
      });
    },

    deleteTrack: function (tabTrackDetails)
    {
        this.dbSQL.transaction(function (tx) {
        tx.executeSql('DELETE FROM track (title, artist, album, url) VALUES (?, ?, ?, ?)',
            [tabTrackDetails["title"].trim().toLowerCase(),
             tabTrackDetails["artist"].trim().toLowerCase(),
             tabTrackDetails["album"].trim().toLowerCase() ,
             tabTrackDetails["url"]]);
        });
    },


    parseSongAttriutes: function (resultsQuery)
    {
        var results = [] ;
        var len = resultsQuery.rows.length
        for (i = 0; i < len; i++) {
            results[i] = [];
            results[i]["title"] = resultsQuery.rows.item(i).title ;
            results[i]["artist"] = resultsQuery.rows.item(i).artist ;
            results[i]["album"] = resultsQuery.rows.item(i).album ;
            results[i]["albumpos"] = resultsQuery.rows.item(i).albumpos ;
            results[i]["year"] = resultsQuery.rows.item(i).year ;
            results[i]["genre"] = resultsQuery.rows.item(i).genre ;
            results[i]["size"] = resultsQuery.rows.item(i).size ;
            results[i]["duration"] = resultsQuery.rows.item(i).duration ;
            results[i]["mimetype"] = resultsQuery.rows.item(i).mimetype ;
            results[i]["bitrate"] = resultsQuery.rows.item(i).bitrate;
            results[i]["url"] = resultsQuery.rows.item(i).url ;
        }
        return results ;
    },


    // Return all the artists
    allArtistsQuery : function()
    {
      var results = [];
      this.dbSQL.transaction(function (tx) {
        tx.executeSql('SELECT DISTINCT artist FROM track WHERE artist LIKE % "'+ artist+ '"%' , [], function (tx, resultsQuery ) {
            var len = resultsQuery.rows.length, i;
            for (i = 0; i < len; i++) {
                results.push (resultsQuery.rows.item(i).artist) ;
            }
            return results ;
        });
      });
    },

    // return all the albums name for this artist
    albumsQuery: function(artistName)
    {
      var results = [] ;
      artistName = artistName.trim().toLowerCase() ;
      this.dbSQL.transaction(function (tx) {
        tx.executeSql('SELECT DISTINCT album FROM track WHERE artist LIKE % "'+ artistName+ '"%' , [], function (tx, resultsQuery ) {
            var len = resultsQuery.rows.length, i;
                for (i = 0; i < len; i++) {
                    results.push (resultsQuery.rows.item(i).album) ;
                }
            return results ;
        });
      });
    },
    

    // return all the tracks of this album
    tracksQuery: function(artistName , albumName)
    {
        artistName = artistName.trim().toLowerCase() ; var results = [] ;
        albumName = albumName.trim().toLowerCase() ;

        this.dbSQL.transaction(function (tx) {
            tx.executeSql('SELECT * FROM track WHERE album LIKE % "'+ albumName+ '"% and artist LIKE % "'+ artistName+ '"%', [],
                function (tx, resultsQuery ) {
                    return parseSongAttriutes(resultsQuery) ;
                });
        });
    },

    // Parse Title, Album , Artist
    searchQuery : function (searchString)
    {
                      // TODO
    },

    // Only one Track matching
    resolve: function(artist, album, title)
    {
        artistName = artistName.trim().toLowerCase() ; var results ;
        albumName = albumName.trim().toLowerCase() ;

        this.dbSQL.transaction(function (tx) {
            tx.executeSql('SELECT * FROM track WHERE album LIKE % "'+artist+ '"% and artist LIKE % "'+album+ '"% and title LIKE % "'+title+ '"% ', [],
                function (tx, resultsQuery ) {
                    results = parseSongAttriutes(resultsQuery) ; // Filtre to give only onre ROW !!!
                    if (results.length > 0 ) return results[0]
                    else return [];
                });

        });
    },

};
