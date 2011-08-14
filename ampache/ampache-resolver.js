
// if run in phantomjs add fake Tomahawk environment
if(window.Tomahawk === undefined)
{
    alert("PHANTOMJS ENVIRONMENT");
    var Tomahawk = {
        fakeEnv: function()
        {
            return true;
        },
        resolverData: function()
        {
            return {
                scriptPath: function()
                {
                    return "/home/tomahawk/resolver.js";
                }
            };
        },
        log: function( message )
        {
            console.log( message );
        }
    };
}

Tomahawk.resolver = {
    scriptPath: Tomahawk.resolverData().scriptPath
};

Tomahawk.timestamp = function() {
    return Math.round( new Date()/1000 );
};

Tomahawk.dumpResult = function( result ) {
    var results = result.results;
    Tomahawk.log("Dumping " + results.length + " results for query " + result.qid + "...");
    for(var i=0; i<results.length;i++)
    {
        var result1 = results[i];
        Tomahawk.log( result1.artist + " - " + result1.track + " | " + result1.url );
    }

    Tomahawk.log("Done.");
};

// javascript part of Tomahawk-Object API
Tomahawk.extend = function(object, members) {
    var F = function() {};
    F.prototype = object;
    var newObject = new F;

    for(var key in members)
    {
        newObject[key] = members[key];
    }

    return newObject;
};


// Resolver BaseObject, inherit it to implement your own resolver
var TomahawkResolver = {
    init: function()
    {
    },
    scriptPath: function()
    {
        return Tomahawk.resolverData().scriptPath;
    },
    getConfigUi: function()
    {
        return {};
    },
    getUserConfig: function()
    {
        var configJson = window.localStorage[ this.scriptPath() ];
        if( configJson === undefined )
    {
            configJson = "{}";
    }

        var config = JSON.parse( configJson );

        return config;
    },
    saveUserConfig: function()
    {
        var config = Tomahawk.resolverData().config;
        var configJson = JSON.stringify( config );

        window.localStorage[ this.scriptPath() ] = configJson;
    },
    resolve: function( qid, artist, album, title )
    {
        return {
            qid: qid
        };
    },
    search: function( qid, searchString )
    {
        return this.resolve( qid, "", "", searchString );
    }
};

/**** begin example implementation of a resolver ****/


// implement the resolver
/*
 *    var DemoResolver = Tomahawk.extend(TomahawkResolver,
 *    {
 *        getSettings: function()
 *        {
 *            return {
 *                name: "Demo Resolver",
 *                weigth: 95,
 *                timeout: 5,
 *                limit: 10
 };
 },
 resolve: function( qid, artist, album, track )
 {
     return {
         qid: qid,
         results: [
         {
             artist: "Mokele",
             album: "You Yourself are Me Myself and I am in Love",
             track: "Hiding In Your Insides (php)",
             source: "Mokele.co.uk",
             url: "http://play.mokele.co.uk/music/Hiding%20In%20Your%20Insides.mp3",
             bitrate: 160,
             duration: 248,
             size: 4971780,
             score: 1.0,
             extension: "mp3",
             mimetype: "audio/mpeg"
 }
 ]
 };
 }
 }
 );

 // register the resolver
 Tomahawk.resolver.instance = DemoResolver;*/

/**** end example implementation of a resolver ****/


// help functions

Tomahawk.valueForSubNode = function(node, tag)
{
    if(node === undefined)
    {
        throw new Error("Tomahawk.valueForSubnode: node is undefined!");
    }

    var element = node.getElementsByTagName(tag)[0];
    if( element === undefined )
    {
        return undefined;
    }

    return element.textContent;
};


Tomahawk.syncRequest = function(url)
{
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.open('GET', url, false);
    xmlHttpRequest.send(null);
    if (xmlHttpRequest.status == 200){
        return xmlHttpRequest.responseText;
    }
};

/**
*
* Secure Hash Algorithm (SHA256)
* http://www.webtoolkit.info/
*
* Original code by Angel Marin, Paul Johnston.
*
**/

Tomahawk.sha256=function(s){

    var chrsz = 8;
    var hexcase = 0;

    function safe_add (x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    function S (X, n) { return ( X >>> n ) | (X << (32 - n)); }
    function R (X, n) { return ( X >>> n ); }
    function Ch(x, y, z) { return ((x & y) ^ ((~x) & z)); }
    function Maj(x, y, z) { return ((x & y) ^ (x & z) ^ (y & z)); }
    function Sigma0256(x) { return (S(x, 2) ^ S(x, 13) ^ S(x, 22)); }
    function Sigma1256(x) { return (S(x, 6) ^ S(x, 11) ^ S(x, 25)); }
    function Gamma0256(x) { return (S(x, 7) ^ S(x, 18) ^ R(x, 3)); }
    function Gamma1256(x) { return (S(x, 17) ^ S(x, 19) ^ R(x, 10)); }

    function core_sha256 (m, l) {
        var K = new Array(0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0xFC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x6CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2);
        var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
        var W = new Array(64);
        var a, b, c, d, e, f, g, h, i, j;
        var T1, T2;

        m[l >> 5] |= 0x80 << (24 - l % 32);
        m[((l + 64 >> 9) << 4) + 15] = l;

        for ( i = 0; i<m.length; i+=16 ) {
            a = HASH[0];
            b = HASH[1];
            c = HASH[2];
            d = HASH[3];
            e = HASH[4];
            f = HASH[5];
            g = HASH[6];
            h = HASH[7];

            for ( j = 0; j<64; j++) {
                if (j < 16)
        {
            W[j] = m[j + i];
        }
                else
        {
            W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
        }

                T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
                T2 = safe_add(Sigma0256(a), Maj(a, b, c));

                h = g;
                g = f;
                f = e;
                e = safe_add(d, T1);
                d = c;
                c = b;
                b = a;
                a = safe_add(T1, T2);
            }

            HASH[0] = safe_add(a, HASH[0]);
            HASH[1] = safe_add(b, HASH[1]);
            HASH[2] = safe_add(c, HASH[2]);
            HASH[3] = safe_add(d, HASH[3]);
            HASH[4] = safe_add(e, HASH[4]);
            HASH[5] = safe_add(f, HASH[5]);
            HASH[6] = safe_add(g, HASH[6]);
            HASH[7] = safe_add(h, HASH[7]);
        }
        return HASH;
    }

    function str2binb (str) {
        var bin = Array();
        var mask = (1 << chrsz) - 1;
        for(var i = 0; i < str.length * chrsz; i += chrsz) {
            bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i%32);
        }
        return bin;
    }

    function Utf8Encode(string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    }

    function binb2hex (binarray) {
        var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
        var str = "";
        for(var i = 0; i < binarray.length * 4; i++) {
            str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
            hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8 )) & 0xF);
        }
        return str;
    }

    s = Utf8Encode(s);
    return binb2hex(core_sha256(str2binb(s), s.length * chrsz));

};



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
        if( params === undefined ) params = [];
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
    },
    getArtists: function( qid )
    {
        var searchResult = this.apiCall( "artists", this.auth );

        Tomahawk.log( searchResult );

        // parse xml
        var domParser = new DOMParser();
        xmlDoc = domParser.parseFromString( searchResult, "text/xml");

        var result = {
            qid: qid,
            results: []
        };
        // check the repsonse
        var root = xmlDoc.getElementsByTagName("root")[0];
        if( root !==undefined && root.childNodes.length > 0)
        {
            var artists = xmlDoc.getElementsByTagName("artist");
            for(var i=0;i<artists.length;i++)
            {
                artistName = Tomahawk.valueForSubNode(artists[i], "name");
                artistId = artists[i].getAttribute("id");

                result.results.push(artistName);
                this.artists[artistName] = artistId;
            }
        }

        return result;
    },
    getAlbums: function( qid, artist )
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

        var result = {
            qid: qid,
            results: []
        };
        // check the repsonse
        var root = xmlDoc.getElementsByTagName("root")[0];
        if( root !==undefined && root.childNodes.length > 0)
        {
            var albums = xmlDoc.getElementsByTagName("album");
            for(var i=0;i<albums.length;i++)
            {
                albumName = Tomahawk.valueForSubNode(albums[i], "name");
                albumId = albums[i].getAttribute("id");

                result.results.push(albumName);

                artistObject = this.albums[artist];
                if( artistObject === undefined ) artistObject = {};
                artistObject[albumName] = albumId;
                this.albums[artist] = artistObject;
            }
        }

        return result;
    },
    getTracks: function( qid, artist, album )
    {
        var artistObject = this.albums[artist];
        var albumId = artistObject[albumName];
        Tomahawk.log("AlbumId for "+ artist + " - " + album + ": " + albumId  );


        var params = {
            filter: albumId
        };

        var searchResult = this.apiCall( "album_songs", this.auth, params );

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

