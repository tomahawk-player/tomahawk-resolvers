/* Qobuz Tomahawk Resolver
 *
 * Adds the Qobuz Search functionality in Tomahawk
 * COPYRIGHT QOBUZ 2012
 *
 */

var debug = false;

// Construct Query from object and url
function http_build_query(url, parameters){
  var qs = "";
  for(var key in parameters) {
    var value = parameters[key];
    qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
  }
  if (qs.length > 0){
    qs = qs.substring(0, qs.length-1); //chop off last "&"
    url = url + "?" + qs;
  }
  return url;
};

// Flatten for a better resolve
function flatten(str)
{
    var rExps=[
    {re:/[\xE0-\xE6]/g, ch:'a'},
    {re:/[\xE8-\xEB]/g, ch:'e'},
    {re:/[\xEC-\xEF]/g, ch:'i'},
    {re:/[\xF2-\xF6]/g, ch:'o'},
    {re:/[\xF9-\xFC]/g, ch:'u'},
    {re:/[\xF1]/g, ch:'n'} ];

    for(var i=0, len=rExps.length; i<len; i++)
    str=str.replace(rExps[i].re, rExps[i].ch);

    // And .. only alphanumeric and no double spaces
    return str.replace(/[^a-z0-9]/gi,' ').replace(/\s{2,}/g, ' ').toLowerCase();
};


/* MAIN RESOLVER
 *
 */ 
var QobuzResolver = Tomahawk.extend(TomahawkResolver, {

    // Basic settings
    settings: {
        name: 'Qobuz (Beta)',
        nameForTracks: 'Qobuz',
        weight: 91,
        timeout: 20
    },
    userAuthToken: false,
    hasFullTracks: false,
    resolverVersion: "0.2",

    // API settings
    apiParameter: {
        endPoint: "http://www.qobuz.com/api.json/0.2/",
        userLogin: "user/login",
        search: "track/search",
        getFileUrl: "track/getFileUrl", 
        app_id: "546568742",
        secret: "6e3e4f6d46c15303c618f474eb7962c3"
    },

    // General configuration
    qobuzTomahawkProtocol: "qobuz",
    formatId: 5, // MP3 320Kbits by default, except if user is HIFI
    purchaseUrl: "http://www.qobuz.com/abonnement-streaming",

    // Get Config UI
    getConfigUi: function () {

        if (debug) Tomahawk.log("# INIT : Constructing UI for version " + this.resolverVersion);

        var uiData = Tomahawk.readBase64("config.ui");

        return {

            "widget": uiData,
            fields: [{
                name: "username",
                widget: "usernameLineEdit",
                property: "text"
            }, {
                name: "password",
                widget: "passwordLineEdit",
                property: "text"
            } ],
            images: [{
                "qobuz.png": Tomahawk.readBase64("qobuz.png")
            } ]

        };
    },

    // Saves user credentials and preferences if any
    newConfigSaved: function () {

        // newUserConfig = new credentials provided by user
        var newUserConfig = this.getUserConfig();

        if (newUserConfig.username != "" && (newUserConfig.username != this.username) || (newUserConfig.password != this.password)) {

            if (debug) Tomahawk.log("# AUTH : Saving new Qobuz credentials with username: " + newUserConfig.username);
            
            // Erasing the current session
            this.userAuthToken = false;
            this.formatId = 5;
            this.hasFullTracks = false;
            window.localStorage['userAuthToken'] = false;
            window.localStorage['hasFullTracks'] = false;
            window.localStorage['formatId'] = 5;

            // Saving credentials
            this.username = newUserConfig.username;
            this.password = newUserConfig.password;

            // Launching init() again
            this.init();
        }
    },

    init: function () {

        var userConfig = this.getUserConfig();

        if (!userConfig.username || !userConfig.password) {
            if (debug) Tomahawk.log("# INIT : Qobuz Resolver is not configured properly. This might be the first use - Try logging in again.");

            // Erasing the current session
            this.userAuthToken = false;
            this.hasFullTracks = false;
            this.formatId = 5;
            window.localStorage['userAuthToken'] = false;
            window.localStorage['hasFullTracks'] = false;
            window.localStorage['formatId'] = 5;

            return;
        }

        if (debug) Tomahawk.log("# INIT : Initing Qobuz Resolver, got credentials: " + userConfig.username );

        this.username = userConfig.username;
        this.password = userConfig.password;

        this.userAuthToken = window.localStorage['userAuthToken'];
        this.hasFullTracks = window.localStorage['hasFullTracks'];
        this.formatId = window.localStorage['formatId'];

        Tomahawk.addCustomUrlHandler( this.qobuzTomahawkProtocol, "getStreamUrl" );
        if (debug) Tomahawk.log("# INIT : Qobuz <-> Tomahawk Protocol registered.");

        this.authenticate();

        // Testing only
//         Tomahawk.log("Getting playlist songs!");
//         this.apiCall('getPlaylistSongs', { playlistID: '64641975' }, function (xhr) {
//             Tomahawk.log("PLAYLIST RESPONSE: " + xhr.responseText );
//         });
//         this.apiCall('getSongsInfo', { songIDs: ['3GBAjY'] }, function(xhr) {
//             Tomahawk.log("GOT SONG INFO:" + xhr.responseText );
//         });
    },


    authenticate: function () {

        if (debug) Tomahawk.log("# AUTH : Qobuz resolver authenticating with username: " + this.username );

        // We build the parameters for this call
        var params;
        if (this.username.indexOf('@') != -1) {
            params = { // User provided us with a username
                email: this.username,
                password: Tomahawk.md5(this.password)
            };
        } else {
            params = { // User provided us with an email
                username: this.username,
                password: Tomahawk.md5(this.password)
            };
        }
        
        var that = this;
        this.apiCall(this.apiParameter.userLogin, params, function (xhr) {
            
            var ret = JSON.parse(xhr.responseText);

            if (ret.user_auth_token && ret.user_auth_token != "" && ret.user_auth_token != null  ) {

                if (debug) Tomahawk.log("# AUTH : Authentication succeeded with username: " + that.username);

                that.userAuthToken = ret.user_auth_token;
                window.localStorage['userAuthToken'] = ret.user_auth_token;

                // Is user premium ?
                that.hasFullTracks = (ret.user.credential.parameters.lossy_streaming == true) ;
                window.localStorage['hasFullTracks'] = that.hasFullTracks;

                // Is user hifi ?
                if (ret.user.credential.parameters.lossless_streaming) {
                    that.formatId = 6;
                    window.localStorage['formatId'] = 6;
                }

                if (debug) Tomahawk.log("#        User is premium ? " + that.hasFullTracks + " (formatId : " + that.formatId + ")");

            } else {

                if (debug) Tomahawk.log("# AUTH : Authentication failed with username: " + that.username );
                that.userAuthToken = false;
                that.hasFullTracks = false;
                that.formatId = 5;
                window.localStorage['userAuthToken'] = false;
                window.localStorage['hasFullTracks'] = false;
                window.localStorage['formatId'] = 5;
            }

        }, false);
    },

    /* Build the Payload and adds the Signature to the arguments
     *
     */
    signRequest: function (methodName, args) {

        // Setp 1
        var payload = methodName.replace('/','');

        // Step 2
        var paramsAsArray = [];

        for(var key in args)
        {
            if(args.hasOwnProperty(key))
            {
                paramsAsArray.push(key+args[key]);
            }
        };

        payload += paramsAsArray.sort().join('');

        // Step 3
        var ts = Math.round((new Date()).getTime() / 1000);
        payload += ts;

        // Step 4
        payload += this.apiParameter.secret;

        // Hashing Parmentier
        var md5Payload = Tomahawk.md5(payload);

        // Creating the new arguments
        var newArgs = args;

            newArgs["request_ts"] = ts;
            newArgs["request_sig"] = md5Payload;
            newArgs["app_id"] = this.apiParameter.app_id;
        if (this.userAuthToken && this.userAuthToken != "")
            newArgs["user_auth_token"] = this.userAuthToken;

        return newArgs;

    },

    /* Makes an Async or Sync request API CALL
     *
     */
    apiCall: function (methodName, args, callback, forceSync) {

        if (debug) Tomahawk.log("## LOW LEVEL : API Async call for method '" + methodName + "'.");

        // Adding the payload / requests to the args (including app_id)
        args = this.signRequest(methodName,args);
        var url = this.apiParameter.endPoint + methodName;

        if (debug) Tomahawk.log("##             - CALL : " + http_build_query(url, args));

        if (forceSync == true)
            return Tomahawk.syncRequest(http_build_query(url, args));
        else
            return Tomahawk.asyncRequest(http_build_query(url, args), callback);

    },

    /* Gets the stream url from the API
     *
     */
    getStreamUrl: function (ourUrl) {

        if (debug) Tomahawk.log("# PLAY : Track requested for streaming: " + ourUrl);

        // Building parameters
        var params = {
            track_id: ourUrl.replace(this.qobuzTomahawkProtocol + "://",""),
            format_id: this.formatId
        };

        // Getting stream (FORCING sync)
        var stream = this.apiCall( this.apiParameter.getFileUrl, params, null, true);
        var ret = JSON.parse(stream);

        // In case the token is not good ?
        if (ret.status && ret.status == "error") {

            if (debug) Tomahawk.log("# PLAY : Error retrieving the file, trying a new login.");
            this.authenticate();

            // We retry once :
            return this.getStreamUrl(ourUrl);

        } else {
            
            if (debug) Tomahawk.log("# PLAY : got the stream: " + ret.url); 

            // We have to set a timeout to report the streaming status
            // window.setTimeout(, 6000);
            // FIX ME

            // We return the stream
            return unescape(ret.url);

        }
        
        return "";
    },

    /* Process an array of items from the API
     *
     */
    process: function (qid, itemsArray) {

        if (!itemsArray) return;

        count = itemsArray.length;

        // Building results
        var results = [];
        var durationTC = [];
        var duration;
        var bitrate = "320";
        var audioMimetype = "audio/mpeg";
        var isPreview = false;

        for (var i = 0; i < count; i++) {

            var retrievedTrack = itemsArray[i];

            // If the track is a sample or if the user is not registered, we gotta change the track info
            isPreview = (!this.hasFullTracks || retrievedTrack.streaming_type == "sample");
            durationTC = retrievedTrack.duration.split(':');
            duration = parseInt(durationTC[0] * 3600 + durationTC[1] * 60 + durationTC[2] * 1);

            // Bitrate information
            if (this.formatId == 6 && retrievedTrack.streaming_type == "full") {
                bitrate = "0";
                audioMimetype = "audio/flac";
            } else {
                bitrate = "320";
                audioMimetype = "audio/mpeg";           
            }

            // Building result array
            var resultTrack = {
                artist: retrievedTrack.interpreter.name,
                album: retrievedTrack.album.title,
                track: retrievedTrack.title,
                source: this.settings.nameForTracks,
                url: this.qobuzTomahawkProtocol + "://" + retrievedTrack.id,
                mimetype: audioMimetype,
                duration: duration,
                bitrate: bitrate,
                year: retrievedTrack.album.release_date.substr(0,4),
                albumpos: retrievedTrack.track_number,
                discnumber: retrievedTrack.media_number,
                preview: isPreview,
                purchaseurl: (isPreview)?this.purchaseUrl:null
                //score: How accurate this search result is, a float, from 0-1.
            }
            results.push(resultTrack);
        };

        // TOMAHAWK Specifications for returning results
        var toReturn = {
            results: results,
            qid: qid
        };

        Tomahawk.addTrackResults(toReturn);

    },

    /* Resolves the current track / album / artist
     *
     */
    resolve: function (qid, artist, album, title) {


        if (debug) Tomahawk.log("# RESOLVE : Resolve initiated with artist=" + artist + ", album=" + album + ", title=" + title);

        if (album == null) album = '';
        if (artist == null) artist = '';
        if (title == null) title = '';

        // Constructing the query string
        var params = {
            query: flatten(artist + ' ' + album + ' ' + title),
            type: "tracks",
            limit: 1
        };

        // Calling the API
        var that = this;
        this.apiCall(this.apiParameter.search, params, function (xhr) {

            var ret = JSON.parse(xhr.responseText);

            // In case of error or no result.
            if ( !ret || !ret.tracks ) return;

            // Maybe another album ? Why not ?
            if (ret.tracks.total == 0) {

                if ( album != '' ) {
                    if (debug) Tomahawk.log("# RESOLVE : NOTHING FOUND ! Relauching resolve without the album");
                    return that.resolve(qid, artist, '', title);
                } else {
                    if (debug) Tomahawk.log("# RESOLVE : NOTHING FOUND ! Sorry");
                    return "";
                }

            };

            if (debug) Tomahawk.log("# RESOLVE : Found a matching track on QOBUZ");

            // Processes and adds to Tomahawk
            that.process(qid, ret.tracks.items);

        });
    },

    /* Search for a query/term
     *
     */
    search: function (qid, searchString) {

        if (debug) Tomahawk.log("# SEARCH : Search initiated on Qobuz");

        // Constructing the query string
        var params = {
            query: flatten(searchString),
            type: "tracks"
        };

        // Calling the API
        var that = this;
        this.apiCall(this.apiParameter.search, params, function (xhr) {

            var ret = JSON.parse(xhr.responseText);

            // In case of error or no result.
            if ( !ret || !ret.tracks ) return;

            var count = ret.tracks.total;

            // Typo ? ==> SUGGEST !
            if (count == 0 && ret.suggestions && ret.suggestions.length != 0 ) {

                if (debug) Tomahawk.log("# SEARCH : TYPO ALERT ! Relauching search on '" + ret.suggestions[0] + "'");
                return that.search(qid, ret.suggestions[0]);

            };

            if (debug) Tomahawk.log("# SEARCH : Found " + count + " tracks on QOBUZ");

            // Processes and adds to Tomahawk
            that.process(qid, ret.tracks.items);

        });
    }
});

// Instanciating the resolver
Tomahawk.resolver.instance = QobuzResolver;