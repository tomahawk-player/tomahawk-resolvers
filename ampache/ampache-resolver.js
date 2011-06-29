
var AmpacheResolver = Tomahawk.extend(TomahawkResolver,
{
    ready: false,
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
            alert("Ampache Resolver not properly configured!");
            return;
        }

        // don't do anything if we already have a valid auth token
        if( window.sessionStorage["ampacheAuth"] )
        {
            alert("Reusing auth token from sessionStorage");
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

        // parse the result
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString(handshakeResult, "text/xml");
        var roots = xmlDoc.getElementsByTagName("root");
        this.auth = roots[0] === undefined ? false : Tomahawk.valueForSubNode( roots[0], "auth" );
        var pingInterval = parseInt(roots[0] === undefined ? 0 : Tomahawk.valueForSubNode( roots[0], "session_length" ))*1000;

        // inform the user if something went wrong
        if( !this.auth )
        {
            alert( "No valid response from server, check user, password and url!" );
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
        params['action'] = action;
        params['auth'] = auth;

        for(param in params)
        {
            if( typeof( params[param] ) == 'string' )
                params[param] = params[param].trim();

            ampacheUrl += encodeURIComponent( param ) + "=" + encodeURIComponent( params[param] ) + "&";
        }
        //Tomahawk.log( ampacheUrl );
        return Tomahawk.syncRequest(ampacheUrl);
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
    }
});

Tomahawk.resolver.instance = AmpacheResolver;




/*
 * TEST ENVIRONMENT
 */

// TomahawkResolver.getUserConfig = function() {
//     return {
//         username: "",
//         password: "",
//         ampache: ""
//     };
// };
//
// var resolver = Tomahawk.resolver.instance;
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
// //tests
// resolver.init();
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

