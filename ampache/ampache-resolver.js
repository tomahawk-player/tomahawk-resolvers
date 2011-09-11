var AmpacheResolver = Tomahawk.extend(TomahawkResolver,
{
    ready: false,
    artists: {},
    albums: {},
    settings:
    {
        name: 'Ampache Resolver',
        weigth: 85,
        timeout: 5,
        limit: 10
    },
    getConfigUi: function()
    {
        var uiData = Tomahawk.readBase64("config.ui");
        return {

            "widget": uiData,
            fields: [
                { name: "username", widget: "usernameLineEdit", property: "text" },
                { name: "password", widget: "passwordLineEdit", property: "text" },
                { name: "ampache", widget: "ampacheLineEdit", property: "text" }
            ],
            images: [
                { "owncloud.png" : Tomahawk.readBase64("owncloud.png") },
                { "ampache.png" : Tomahawk.readBase64("ampache.png") }
            ]
        };
    },
    init: function()
    {
        // check resolver is properly configured
        var userConfig = this.getUserConfig();
        if( !userConfig.username || !userConfig.password || !userConfig.ampache )
        {
            Tomahawk.log("Ampache Resolver not properly configured!");
            return;
        }

        // don't do anything if we already have a valid auth token
        if( window.sessionStorage["ampacheAuth"] )
        {
            Tomahawk.log("Ampache resolver not using auth token from sessionStorage");
            return window.sessionStorage["ampacheAuth"];
        }

        // prepare handshake arguments
        var time = Tomahawk.timestamp();
        var key = Tomahawk.sha256( userConfig.password );
        var passphrase = Tomahawk.sha256( time + key );

        // do the handshake
        var params = {
            timestamp: time,
            version: 350001,
            user: userConfig.username
        }
        try { handshakeResult = this.apiCall( 'handshake', passphrase, params ); }
            catch(e) { return; }

        Tomahawk.log(handshakeResult);

        // parse the result
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString(handshakeResult, "text/xml");
        var roots = xmlDoc.getElementsByTagName("root");
        this.auth = roots[0] === undefined ? false : Tomahawk.valueForSubNode( roots[0], "auth" );
        var pingInterval = parseInt(roots[0] === undefined ? 0 : Tomahawk.valueForSubNode( roots[0], "session_length" ))*1000;

        // inform the user if something went wrong
        if( !this.auth )
        {
            Tomahawk.log("INVALID HANDSHAKE RESPONSE: " + handshakeResult);
        }

        // all fine, set the resolver to ready state
        this.ready = true;
        window.sessionStorage["ampacheAuth"] = this.auth;

        // setup pingTimer
        if( pingInterval )
            window.setInterval(this.ping, pingInterval-60);

        Tomahawk.log("Ampache Resolver properly initialised!");
    },
    apiCall: function(action, auth, params)
    {
        var ampacheUrl = this.getUserConfig().ampache + "/server/xml.server.php?";
        if( params === undefined ) params = [];
        params['action'] = action;
        params['auth'] = auth;


        for(param in params)
        {
            if( typeof( params[param] ) == 'string' )
                params[param] = params[param].trim();

            ampacheUrl += encodeURIComponent( param ) + "=" + encodeURIComponent( params[param] ) + "&";
        }
        var result = Tomahawk.syncRequest(ampacheUrl);
        //Tomahawk.log( result );
        return result;
    },
    ping: function()
    {
        // this is called from window scope (setInterval), so we need to make methods and data accessible from there
        Tomahawk.log( AmpacheResolver.apiCall( 'ping', AmpacheResolver.auth, {} ) );
    },
    parseSongResponse: function( qid, responseString )
    {
        // parse xml
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString( responseString, "text/xml");

        var results = new Array();
        // check the repsonse
        var songElements = xmlDoc.getElementsByTagName("song")[0];
        if( songElements !==undefined && songElements.childNodes.length > 0)
        {
            var songs = xmlDoc.getElementsByTagName("song");

            // walk through the results and store it in 'results'
            for(var i=0;i<songs.length;i++)
            {
                var song = songs[i];

                var result = {
                    artist: Tomahawk.valueForSubNode(song, "artist"),
                    album: Tomahawk.valueForSubNode(song, "album"),
                    track: Tomahawk.valueForSubNode(song, "title"),
                    //result.year = 0;//valueForSubNode(song, "year");
                    source: this.settings.name,
                    url: Tomahawk.valueForSubNode(song, "url"),
                    //mimetype: valueForSubNode(song, "mime"), //FIXME what's up here? it was there before :\
                    //result.bitrate = valueForSubNode(song, "title");
                    size: Tomahawk.valueForSubNode(song, "size"),
                    duration: Tomahawk.valueForSubNode(song, "time"),
                    score: Tomahawk.valueForSubNode(song, "rating")
                };

                results.push(result);
            }
        }

        // prepare the return
        var return1 =  {
            qid: qid,
            results: results
        };

        //Tomahawk.dumpResult( return1 );
        return return1;
    },
    resolve: function( qid, artist, album, title )
    {
        return this.search( qid, title );
    },
    search: function( qid, searchString )
    {
        if( !this.ready ) return { qid: qid };

        userConfig = this.getUserConfig();

        var params = {
            filter: searchString,
            limit: this.settings.limit
        };
        var searchResult = this.apiCall( "search_songs", this.auth, params );

        //Tomahawk.log( searchResult );

        return this.parseSongResponse( qid, searchResult );
    },
    getArtists: function( qid )
    {
        var searchResult = this.apiCall( "artists", this.auth );

        Tomahawk.log( searchResult );

        // parse xml
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString( searchResult, "text/xml");

        var results = [];

        // check the repsonse
        var root = xmlDoc.getElementsByTagName("root")[0];
        if( root !==undefined && root.childNodes.length > 0)
        {
            var artists = xmlDoc.getElementsByTagName("artist");
            for(var i=0;i<artists.length;i++)
            {
                artistName = Tomahawk.valueForSubNode(artists[i], "name");
                artistId = artists[i].getAttribute("id");

                results.push(artistName);
                this.artists[artistName] = artistId;
            }
        }

        return results;
    },
    getAlbums: function( artist )
    {
        var artistId = this.artists[artist];

        var params = {
            filter: artistId
        };

        var searchResult = this.apiCall( "artist_albums", this.auth, params );

        //Tomahawk.log( searchResult );

        // parse xml
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString( searchResult, "text/xml");

        var results = [];

        // check the repsonse
        var root = xmlDoc.getElementsByTagName("root")[0];
        if( root !==undefined && root.childNodes.length > 0)
        {
            var albums = xmlDoc.getElementsByTagName("album");
            for(var i=0;i<albums.length;i++)
            {
                albumName = Tomahawk.valueForSubNode(albums[i], "name");
                albumId = albums[i].getAttribute("id");

                results.push(albumName);

                artistObject = this.albums[artist];
                if( artistObject === undefined ) artistObject = {};
                artistObject[albumName] = albumId;
                this.albums[artist] = artistObject;
            }
        }

        return results;
    },
    getTracks: function( artist, album )
    {
        var artistObject = this.albums[artist];
        var albumId = artistObject[albumName];
        Tomahawk.log("AlbumId for "+ artist + " - " + album + ": " + albumId  );


        var params = {
            filter: albumId
        };

        var searchResult = this.apiCall( "album_songs", this.auth, params );

        //Tomahawk.log( searchResult );


        return this.parseSongResponse( 1337, searchResult );
    }
});

Tomahawk.resolver.instance = AmpacheResolver;




/*
 * TEST ENVIRONMENT
 */

/*TomahawkResolver.getUserConfig = function() {
    return {
        username: "domme",
        password: "foo",
        ampache: "http://owncloud.lo/ampache"
        //ampache: "http://owncloud.lo/apps/media"
    };
};*/
//
var resolver = Tomahawk.resolver.instance;
//
//
// // configure tests
// var search = {
//     filter: "I Fell"
// };
//
// var resolve = {
//     artist: "The Aquabats!",
//     title: "I Fell Asleep On My Arm"
// };
// // end configure
//
//
//
//
//tests
//resolver.init();
//
// // test search
// //Tomahawk.log("Search for: " + search.filter );
// var response1 = resolver.search( 1234, search.filter );
// //Tomahawk.dumpResult( response1 );
//
// // test resolve
// //Tomahawk.log("Resolve: " + resolve.artist + " - " + resolve.album + " - " + resolve.title );
// var response2 = resolver.resolve( 1235, resolve.artist, resolve.album, resolve.title );
// //Tomahawk.dumpResult( response2 );

// Tomahawk.log("test");
// n = 0;
// var items = resolver.getArtists( n ).results;
// for(var i=0;i<items.length;i++)
// {
//     artist = items[i];
//     Tomahawk.log("Artist: " + artist);
//     var albums = resolver.getAlbums( ++n, artist ).results;
//     for(var j=0;j<albums.length;j++)
//     {
//         var album = albums[j];
//         Tomahawk.dumpResult( resolver.getTracks( ++n, artist, album ) );
//     }
// }
//
// phantom.exit();

