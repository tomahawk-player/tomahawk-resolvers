

var AmpacheResolver = Tomahawk.extend(TomahawkResolver,
{
    getSettings: function()
    {
        return {
            name: "Ampache Resolver",
            weigth: 85,
            timeout: 5,
            limit: 10
        };
    },
    getConfigUi: function()
    {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [
                { name: "username", widget: ["usernameLineEdit"], property: "text" },
                { name: "password", widget: ["passwordLineEdit"], property: "text" },
                { name: "ampache", widget: ["ampacheLineEdit"], property: "text" }
            ],
            images: [
                { "owncloud.png" : Tomahawk.readBase64("owncloud.png") },
                { "ampache.png" : Tomahawk.readBase64("ampache.png") }
            ]
        };
    },
    resolve: function( qid, artist, album, track )
    {
        var userConfig = this.getUserConfig();
        if( !userConfig.username || !userConfig.password || !userConfig.ampache )
        {
            console.log("Ampache Resolver not properly configured!");
            return;
        }
        var authToken = function( handshakeResult )
        {
            var domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(handshakeResult, "text/xml");

            var roots = xmlDoc.getElementsByTagName("root");

            return (roots[0] === undefined ? false : Tomahawk.valueForSubNode( roots[0], "auth" ) )
        };

        if( !window.sessionStorage["ampacheAuth"] )
        {
            // do handshake
            var time = Number( new Date() );
            var key = Tomahawk.sha256( userConfig.password );//hash('sha256','mypassword');
            var passphrase = Tomahawk.sha256( time + key );

            var handshakeUrl = userConfig.ampache
            + "/server/xml.server.php?action=handshake&auth="+ encodeURIComponent( passphrase )
            + "&timestamp="+ encodeURIComponent( time )
            + "&version=350001"
            + "&user=" + encodeURIComponent( userConfig.username );

            var handshakeResult = Tomahawk.syncRequest( handshakeUrl );
            var auth = authToken( handshakeResult );
            if( !auth )
                console.log( "No valid response from server, check user, password and url!" );

            window.sessionStorage["ampacheAuth"] = auth;
        }
        else
        {
            // reuse session token
            auth = window.sessionStorage["ampacheAuth"];
        }

        var filter = artist + " " + album + " " + track;
        var searchUrl = userConfig.ampache
        + "/server/xml.server.php?action=search_songs&auth="+ encodeURIComponent( auth )
        + "&filter=" + encodeURIComponent( filter.trim() );
        + "&limit="+userConfig.limit;

        var searchResult = Tomahawk.syncRequest( searchUrl );

        // parse xml
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString(searchResult, "text/xml");

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
                    source: this.getSettings().name,
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
        return {
            qid: qid,
            results: results
        };
    }
});


Tomahawk.resolver.instance = AmpacheResolver;
