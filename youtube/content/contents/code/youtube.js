/*
 * Copyright (C) 2012 Hugo Lindström <hugolm84@gmail.com>
 * Copyright (C) 2011-2015 Thierry Göckel <thierry@strayrayday.lu>
 * Copyright (C) 2012 Leo Franchi <lfranchi@kde.org>
 * Copyright (C) 2015 Anton Romanov <theliua@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * NOTICE: This resolver and its intent, is for demonstrational purposes only
 **/

var YoutubeResolver = Tomahawk.extend( Tomahawk.Resolver, {

    apiVersion: 0.9,

    settings: {
        name: 'YouTube',
        icon: 'youtube-icon.png',
        weight: 70,
        timeout: 15
    },

    hatchet: false,

    resolveMode: false,

    bitratesToItags : {
        // we are not including LIVE itags and the ones with audio bitrate < 64
        // Of course we will also not include VIDEO-ONLY itags for this
        // resolver 
        // Each one in order of prefefence
        "64" : [
            250,//DASH Audio only / Opus
            5, //FLV 240o/ MP3
            6, //FLV 270p/ MP3
        ],
        "96" : [
            83,//240p MP4/ AAC
            18,//360p MP4/ AAC
            82,//360p MP4/ AAC
        ],
        "128" : [
            140,//DASH Audio only / AAC
            171,//DASH Audio only / Vorbis
            100,//360p WebM/ Opus
            34,//360p FLV/ AAC
            43,//360p WebM/ Opus
            35,//480p FLV/ AAC
            44,//480p WebM/ Opus
        ],
        "160" : [
            251,//DASH Audio only / Opus
        ],
        "192" : [
            172,//DASH Audio only / Vorbis
            101,//360p WebM/ Opus
            22,//720p MP4/ AAC
            45,//720p WebM/ Opus
            101,//720p WebM/ Opus
            84,//720p MP4/ AAC
            37,//1080p MP4/ AAC
            46,//1080p WebM/ Opus
            85,//1080p MP4/ AAC
            38,//3072p MP4/ AAC
        ],
        "256" : [
            141,//DASH Audio only / AAC
        ]
    },

    bitrateSelectedIndexToBitrate : [ "64", "96", "128", "160", "192", "256" ],

    init: function(callback)
    {
        "use strict";

        this.deobfuscateFunctions = {};

        // Set userConfig here
        var userConfig = this.getUserConfig();
        if ( Object.getOwnPropertyNames( userConfig ).length > 0 )
        {
            this.includeCovers = userConfig.includeCovers;
            this.includeRemixes = userConfig.includeRemixes;
            this.includeLive = userConfig.includeLive;
            this.qualityPreference = userConfig.qualityPreference;
            this.debugMode = userConfig.debugMode;
        }
        else
        {
            this.includeCovers = false;
            this.includeRemixes = false;
            this.includeLive = false;
            this.qualityPreference = 1;
            this.debugMode = 1;
        }

        // Protos
        String.prototype.capitalize = function() {
            return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2) { return p1+p2.toUpperCase(); } );
        };
        String.prototype.regexIndexOf = function( regex, startpos ) {
            var indexOf = this.substring( startpos || 0 ).search( regex );
            return ( indexOf >= 0 ) ? ( indexOf + ( startpos || 0 ) ) : indexOf;
        };
        String.prototype.splice = function( idx, rem, s ) {
            return ( this.slice( 0, idx ) + s + this.slice( idx + Math.abs( rem ) ) );
        };
        if (callback){
            callback(null);
        }
    },

    getConfigUi: function()
    {
        "use strict";

        var uiData = Tomahawk.readBase64( "config.ui" );
        return {
            "widget": uiData,
            fields: [{
                name: "includeCovers",
                widget: "covers",
                property: "checked"
            }, {
                name: "includeRemixes",
                widget: "remixes",
                property: "checked"
            }, {
                name: "includeLive",
                widget: "live",
                property: "checked"
            }, {
                name: "qualityPreference",
                widget: "qualityDropdown",
                property: "currentIndex"
            }, {
                name: "debugMode",
                widget: "debug",
                property: "checked"
            }],
            images: [{
                "youtube.png" : Tomahawk.readBase64("youtube.png")
            }]
        };
    },

    apiCall : function(method, params) 
    {
        params['key'] = 'AIzaSyD22x7IqYZp' + 'f3cn27wL9' + '8MQg2FWnno_JHA'
        return Tomahawk.get("https://www.googleapis.com/youtube/v3/" + method, 
                { data : params });
    },

    newConfigSaved: function ()
    {
        "use strict";

        var userConfig = this.getUserConfig();
        if ((userConfig.includeCovers !== this.includeCovers) || (userConfig.includeRemixes !== this.includeRemixes) ||
            (userConfig.includeLive !== this.includeLive) || (userConfig.qualityPreference !== this.qualityPreference))
        {
            this.includeCovers = userConfig.includeCovers;
            this.includeRemixes = userConfig.includeRemixes;
            this.includeLive = userConfig.includeLive;
            this.qualityPreference = userConfig.qualityPreference;
            this.debugMode = userConfig.debugMode;
            this.saveUserConfig();
        }
    },

    debugMsg: function( msg )
    {
        "use strict";
        Tomahawk.log('debugMsg called');

        if ( msg.toLowerCase().indexOf( "assert" ) === 0 )
        {
            Tomahawk.log( this.settings.name + msg );
        }
        else if ( this.debugMode )
        {
            Tomahawk.log( this.settings.name + " debug: " + msg );
        }
    },

    iso8601toSeconds: function( iso8601 )
    {
        "use strict";

        var matches = iso8601.match( /[0-9]+[HMS]/g );
        var seconds = 0;
        matches.forEach( function ( part ) {
            var unit = part.charAt( part.length - 1 );
            var amount = parseInt( part.slice( 0, -1 ), 10 );
            switch ( unit ) {
                case 'H':
                    seconds += amount * 60 *60;
                    break;
                case 'M':
                    seconds += amount * 60;
                    break;
                case 'S':
                    seconds += amount;
                    break;
                default:
                    Tomahawk.log( "Erroneous ISO8601 format: " + iso8601 );
                    break;
            }
        });
        return seconds;
    },

    magicCleanup: function( toClean )
    {
        "use strict";

        return toClean.replace( /[^A-Za-z0-9 ]|(feat|ft.|featuring|prod|produced|produced by)/g, "" ).replace( /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'' ).replace( /\s+/g,' ' ).toLowerCase();
    },

    getMostRelevant: function( results )
    {
        "use strict";

        var finalResult = results[0];
        for ( var j = 0; j < results.length; j++ )
        {
            Tomahawk.log(JSON.stringify(results[j]));
            if (
                    results[j].score > finalResult.score ||
                    (results[j].score == finalResult.score && (results[j].id < finalResult.id || ( results[j].url && results[j].bitrate > finalResult.bitrate ) ))
               )
            {
                finalResult = results[j];
            }
        }
        delete finalResult.id;
        return finalResult;
    },

    hasPreferredQuality: function( urlString, quality )
    {
        "use strict";

        if ( this.qualityPreference === undefined )
        {
            this.debugMsg( "ASSERT: quality undefined!" );
            return true;
        }
        
        if ( quality === this.getPreferredQuality() || urlString.indexOf("quality=" + this.getPreferredQuality() ) !== -1 )
        {
            return true;
        }
        return false;
    },
    
    getPreferredQuality: function()
    {
        "use strict";

        if ( this.qualityPreference === undefined )
        {
            this.qualityPreference = 0;
        }

        switch ( this.qualityPreference )
        {
            case 0:
                return "hd720";
            case 1:
                return "medium";
            case 2:
                return "small";
            default:
                return "hd720";
        }
        // To make Lint happy
        return "hd720";
    },

    getBitrate: function ( itag )
    {
        "use strict";

        itag = parseInt(itag);
        for(var bitrate in this.bitratesToItags)
        {
            if(this.bitratesToItags[bitrate].indexOf(itag) !== -1)
            {
                return bitrate;
            }
        }
        this.debugMsg("Unexpected itag in getBitrate: " + itag.toString());
        return 128;//how we can even get there?
    },

    getTrack: function ( trackTitle, origTitle, isSearch )
    {
        "use strict";

        if ( ( this.includeCovers === false || this.includeCovers === undefined ) && trackTitle.search( /(\Wcover(?!(\w)))/i ) !== -1 && origTitle.search( /(\Wcover(?!(\w)))/i ) === -1 )
        {
            return null;
        }
        // Allow remix:es in search results?
        if ( isSearch === undefined )
        {
            if ( ( this.includeRemixes === false || this.includeRemixes === undefined ) && trackTitle.search( /(\W(re)*?mix(?!(\w)))/i ) !== -1 && origTitle.search( /(\W(re)*?mix(?!(\w)))/i ) === -1 )
            {
                return null;
            }
        }
        if ( ( this.includeLive === false || this.includeLive === undefined ) && trackTitle.search( /(live(?!(\w)))/i ) !== -1 && origTitle.search( /(live(?!(\w)))/i ) === -1 )
        {
            return null;
        }
        else
        {
            return trackTitle;
        }
    },

    cleanupAndParseTrack: function( title, searchString )
    {
        "use strict";

        var result = {};
        // For the ease of parsing, remove these
        // Maybe we could up the score a bit?
        if ( title.regexIndexOf( /(?:[([](?=(official))).*?(?:[)\]])|(?:(official|video)).*?(?:(video))/i, 0 ) !== -1 )
        {
            title = title.replace( /(?:[([](?=(official|video))).*?(?:[)\]])/gi, "" );
            title = title.replace( /(official|video(?:([!:-])))/gi, "" );
            result.isOfficial = 1;
        }
        result.query = title;
        // Sometimes users separate titles with quotes :
        // eg, "\"Young Forever\" Jay Z | Mr. Hudson (OFFICIAL VIDEO)"
        // this will parse out the that title
        var inQuote = title.match( /([""'])(?:(?=(\\?))\2.).*\1/g );
        if ( inQuote && inQuote !== undefined )
        {
            result.track = inQuote[0].substr( 1, inQuote[0].length - 2 );
            title = title.replace( inQuote[0], '' );
            result.fromQuote = result.track;
            result.parsed = this.parseCleanTrack( title );
            if ( result.parsed )
            {
                result.parsed.track = result.track;
                return result.parsed;
            }
        }
        else 
        {
            result.parsed = this.parseCleanTrack( title );
            if ( result.parsed )
            {
                return result.parsed;
            }
        }

        // Still no luck, lets go deeper
        if ( !result.parsed )
        {
            if ( title.toLowerCase().indexOf( searchString.toLowerCase() ) !== -1 )
            {
                result.parsed = this.parseCleanTrack( title.replace( RegExp( this.escapeRegExp(searchString), "gi" ), searchString.concat( " :" ) ) );
            }
            else
            {
                var tryMatch = searchString.replace( /(?:[-–—|:&])/g, " " );
                if ( title.toLowerCase().indexOf( tryMatch.toLowerCase() ) !== -1 )
                {
                    var replaceWith;
                    if ( title.regexIndexOf( /(?:[-–—|:&])/g, 0 ) !== -1 )
                    {
                        replaceWith = searchString;
                    }
                    else
                    {
                        replaceWith = searchString.concat( " : " );
                    }
                    result.parsed = this.parseCleanTrack( title.replace( RegExp( tryMatch, "gi" ), replaceWith ) );
                }
            }
        }

        if ( result.fromQuote && result.fromQuote !== undefined )
        {
            if ( result.parsed )
            {
                result.artist = result.parsed.artist;
            }
            result.track = result.fromQuote;
        }
        else if ( result.parsed )
        {
            if ( result.parsed.artist !== undefined )
            {
                result.artist = result.parsed.artist;
            }
            if ( result.parsed.track !== undefined )
            {
                result.track = result.parsed.track;
            }
        }
        delete result.parsed;
        return result;
    },

    parseCleanTrack: function( track )
    {
        "use strict";

        var result = {};
        result.query = track;
        result.query.replace( /.*?(?=([-–—:|]\s))/g, function ( param ) {
            if ( param.trim() !== "" )
            {
                if ( result.artist === undefined )
                {
                    result.artist = param;
                }
                else
                {
                    if ( result.track === undefined )
                    {
                        result.track = param;
                    }
                }
            }
        });

        result.query.replace( /(?=([-–—:|]\s)).*/g, function ( param ) {
            if ( param.trim() !== "" )
            {
                if ( param.regexIndexOf( /([-–—|:]\s)/g, 0 ) === 0 )
                {
                    if ( result.track === undefined )
                    {
                        result.track = param.replace( /([-–—|:]\s)/g, "" );
                    }
                }
                else
                {
                    if ( result.artist === undefined )
                    {
                        result.artist = param;
                    }
                    result.track = result.replace( /([-–—|:]\s)/g, "" );
                }
            }
        });

        if ( result.track !== undefined && result.artist !== undefined )
        {
            // Now, lets move featuring to track title, where it belongs
            var ftmatch = result.artist.match( /(?:(\s)(?=(feat.|feat|ft.|ft|featuring)(?=(\s)))).*/gi );
            if ( ftmatch )
            {
                result.artist = result.artist.replace( ftmatch, "" );
                result.track += " " + ftmatch;
            }
            // Trim
            result.track = result.track.replace( /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'' ).replace( /\s+/g,' ' );
            result.artist = result.artist.replace( /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'' ).replace( /\s+/g,' ' );
            return result;
        }
        return null;
    },

    _parseQueryString : function( queryString ) {
        var params = {}, queries, temp, i, l;

        // Split into key/value pairs
        queries = queryString.split("&");

        // Convert the array of strings into an object
        for ( i = 0, l = queries.length; i < l; i++ ) {
            temp = queries[i].split('=');
            params[temp[0]] = decodeURIComponent(temp[1]);
        }

        return params;
    },

    escapeRegExp : function (str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    },

    _extract_object : function( code, name, known_objects ) {
        //For now objects we need to extract were always self contained so we
        //just regex-extract it and return
        this.debugMsg('Extracting object:' + name);
        var objectRE = new RegExp('(?:var\\s+)?' +
                this.escapeRegExp(name) + '\\s*=\\s*\\{\\s*(([a-zA-Z$0-9]+\\s*:\\s*function\\(.*?\\)\\s*\\{.*?\\})*)\\}\\s*;');
        var obj_M = code.match(objectRE);
        return obj_M[0];
    },

    _extract_function : function( code, name, known_objects ) {
        this.debugMsg('Extracting function:' + name);
        var functionCode = '';
        if (typeof known_objects === 'undefined')
        {
            known_objects = {
                names: [ name ]
            };
        }
        var f_RE = new RegExp('(?:function\\s+' + this.escapeRegExp(name) + '|[{;\\s]' +
            this.escapeRegExp(name) + '\\s*=\\s*function)\\s*\\(([^)]*)\\)\\s*\\{([^}]+)\\}');
        this.debugMsg('(?:function\\s+' + name + '|[{;]' +
            name + '\\s*=\\s*function)\\s*\\(([^)]*)\\)\\s*\\{([^}]+)\\}');
        var f_match = code.match(f_RE);
        if ( f_match )
        {
            this.debugMsg('Args for function ' + name + ' is: ' + f_match[1]);
            this.debugMsg('Body for function ' + name + ' is: ' + f_match[2]);
            var args = f_match[1].split(',');
            known_objects.names = known_objects.names.concat(args);
            this.debugMsg(JSON.stringify(known_objects));
            var statements = f_match[2].split(';');
            for(var i = 0; i < statements.length; i++)
            {
                var stmt = statements[i].trim();
                var callRE = /(?:^|[=\+-\s]+)([a-zA-Z$0-9\.]+)\s*\(/gm;
                var match;
                this.debugMsg('Processing stmt:' + stmt);
                while ((match = callRE.exec(stmt)) !== null)
                {
                    this.debugMsg('Processing call:' + match[1]);
                    var split = match[1].split('.');
                    if (split.length == 1)
                    {
                        //function
                        if (known_objects.names.indexOf(split[0]) == -1) 
                        {
                            functionCode += this._extract_function(code, split[0], known_objects);
                            known_objects.names.push(split[0]);
                        }
                    } else {
                        //object
                        this.debugMsg('see if object is known:' + split[0]);
                        this.debugMsg(known_objects.names.indexOf(split[0]).toString());
                        if (known_objects.names.indexOf(split[0]) == -1) 
                        {
                            functionCode += this._extract_object(code, split[0], known_objects);
                            known_objects.names.push(split[0]);
                        }
                    }
                }
            }
            return functionCode + f_match[0];
        }
        return null;
    },

    parseURLS: function( rawUrls, html )
    {
        "use strict";

        var parsedUrls = [];
        var that = this;
        var urlArray = rawUrls.split( /,/g ).map(function(r) { return that._parseQueryString(r);});
        //Start from the top (user preffeded/max quality and go down from that
        for ( var i = that.qualityPreference; i >= 0; --i)
        {
            var itags = that.bitratesToItags[that.bitrateSelectedIndexToBitrate[i]];
            for (var itagI = 0; itagI < itags.length; ++itagI){
                var itag = itags[itagI];
                var prefUrl = urlArray.filter(function(params){return params['itag'] == itag;});
                if (prefUrl.length > 0)
                {
                    var params = prefUrl[0];
                    that.debugMsg(JSON.stringify(params));

                    if (params.sig) {
                        params.url += '&signature=' + params.sig;
                        return params;
                    } else if (params.s) {
                        //lets try to extract deobfuscation function automatically
                        //URL list for future testing, please append the new ones so
                        //that if anything breaks we can make sure our code works on
                        //all variants we have seen so far
                        //  s.ytimg.com/yts/jsbin/html5player-new-en_US-vflOWWv0e/html5player-new.js
                        //  s.ytimg.com/yts/jsbin/html5player-new-en_US-vflCeB3p5/html5player-new.js
                        //  s.ytimg.com/yts/jsbin/html5player-new-en_US-vfliM_xst/html5player-new.js
                        //  s.ytimg.com/yts/jsbin/html5player-new-en_US-vflt2Xpp6/html5player-new.js
                        //  etc...etc
                        //
                        var ASSETS_RE = /"assets":.+?"js":\s*("[^"]+")/;
                        var assetsMatch = html.match( ASSETS_RE );
                        if ( assetsMatch )
                        {
                            this.debugMsg('player js: ' + JSON.parse(assetsMatch[1]));
                            var js_player_url = JSON.parse(assetsMatch[1]);
                            if (js_player_url.indexOf('//') === 0)
                                js_player_url = 'https:' + js_player_url;
                            var dec;
                            if (js_player_url in that.deobfuscateFunctions)
                            {
                                that.debugMsg('Deobfuscation code already available');
                                dec = that.deobfuscateFunctions[js_player_url];
                            } else {
                                dec = Tomahawk.get(js_player_url).then(function (code) {
                                    //Extract top signature deobfuscation function name
                                    var decrypt_function_RE = /\.sig\|\|([a-zA-Z0-9$]+)\(/;
                                    var fname = code.match( decrypt_function_RE );
                                    if ( fname )
                                    {
                                        fname = fname[1];
                                        that.debugMsg('Deobfuscate function name: ' + fname);
                                        var func = that._extract_function(code, fname);
                                        that.debugMsg('Extracted deobfuscation code is:' + func);
                                        that.deobfuscateFunctions[js_player_url] = {
                                            code : func,
                                            name : fname
                                        };
                                        return that.deobfuscateFunctions[js_player_url];
                                    }
                                });
                            }
                            return RSVP.Promise.all([dec,params]).then(function(data){
                                var params = data[1];
                                var dec    = data[0];
                                if(dec)
                                {
                                    params.url += '&signature=' + eval(dec.code + dec.name + '("' + params.s + '");');
                                    return params;
                                }
                            });
                        }
                    } else {
                        return params;
                    }
                }
            }
        }
    },

    getStreamUrl: function(params) {
        return {
            url: params.url,
            headers: {
                'User-Agent': 'Mozilla/6.0 (X11; Ubuntu; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0'
            }
        }
    },


    resolve: function( params )
    {
        "use strict";

        var artist = params.artist;
        var album = params.album;
        var title = params.track;
        this.resolveMode = true;
        var query;
        if ( artist !== "" )
        {
            query = artist + " ";
        }
        if ( title !== "" )
        {
            query += title;
        }

        var queryParams = {
            part : 'snippet',
            maxResults : 5,
            order : 'relevance',
            type : 'video',
            q : query + ' Auto-generated by YouTube'
        };
        var queryParams2 = Tomahawk.extend(queryParams, { query : query });
        if ( this.hatchet )
        {
            apiQuery += "&videoEmbeddable=true";
        }
        var that = this;
        return Promise.all([this.apiCall( 'search', queryParams), this.apiCall('search', queryParams2)]).then(function( responses ) {
            var items = responses[0].items.concat(responses[1].items);
            if ( items.length > 0 )
            {
                var results = [];
                //Lets fetch page for first result, usually if Google detected
                //a proper track there it'll be in description with links to
                //amazon/itunes/google stores. That would be the best result
                //tbh
                return Tomahawk.get('https://www.youtube.com/watch?v=' + items[0].id.videoId).then(function(page){
                    var startIndex = 0;
                    var r = /"content watch-info-tag-list">[\s]+<li>&quot;(.*?)&quot;\s+by\s+(.*?)\s\(<a[\s]+href/mg;
                    var match = r.exec(page);
                    if (match) {
                        startIndex = 1;
                        var _artist = match[2];
                        var _track = match[1];
                        var artistChannelRe = /<a[^>]+>([^<]+)/g;
                        var artistChannelMatch = artistChannelRe.exec(_artist);
                        if (artistChannelMatch) {
                            _artist = artistChannelMatch[1];
                        }
                        var responseItem = items[0];
                        var result = {
                            track : Tomahawk.htmlDecode(_track),
                            //by
                            artist : Tomahawk.htmlDecode(_artist),

                            source : that.settings.name,
                            mimetype : "video/h264",
                            score : 0.85,
                            youtubeVideoId : responseItem.id.videoId,
                            linkUrl : "https://www.youtube.com/watch?v=" + responseItem.id.videoId,
                            id : 0
                        };

                        results.push( result );
                    }
                    for ( var i = startIndex; i < items.length; i++ )
                    {
                        var responseItem = items[i];
                        if ( responseItem === undefined )
                        {
                            continue;
                        }
                        var responseTitle = responseItem.snippet.title.toLowerCase();
                        // Check whether the artist and title (if set) are in the returned title, discard otherwise
                        if ( responseTitle !== undefined && responseTitle.indexOf( artist.toLowerCase() ) === -1 ||
                            ( title !== "" && responseTitle.toLowerCase().indexOf( title.toLowerCase() ) === -1 ) )
                        {
                            // Lets do a deeper check
                            // Users tend to insert [ft. Artist] or **featuring Artist & someOther artist
                            // Remove these
                            var newTitle = that.magicCleanup( title );
                            var newArtist = that.magicCleanup( artist );
                            var newRespTitle = that.magicCleanup( responseTitle );
                        
                            if ( newRespTitle !== undefined && newRespTitle.indexOf( newArtist ) === -1 ||
                                ( newTitle !== "" && newRespTitle.indexOf( newTitle ) === -1 ) )
                            {
                                // Lets do it in reverse!
                                if ( newArtist.indexOf( newTitle ) === -1 && newTitle.indexOf( newArtist ) === -1 )
                                {
                                    continue;
                                }
                            }
                        }
                        if ( that.getTrack( responseTitle, title ) )
                        {
                            var result = {};
                            if ( artist !== "" )
                            {
                                result.artist = artist;
                            }
                            result.source = that.settings.name;
                            result.mimetype = "video/h264";
                            result.score = 0.65;
                            result.year = responseItem.snippet.publishedAt.slice( 0, 4 );
                            result.track = title;
                            result.youtubeVideoId = responseItem.id.videoId;
                            result.linkUrl = "https://www.youtube.com/watch?v=" + result.youtubeVideoId;
                            result.id = i;
                            results.push( result );
                        }
                    }
                    if (results.length === 0) { // if no results had appropriate titles, return empty
                        return [];
                    }
                    else
                    {
                        if ( that.hatchet )
                        {
                            return [that.getMostRelevant( results )];
                        }
                        else
                        {
                            return that.getMetadata( results );
                        }
                    }
            });
            }
            else
            {
                return [];
            }
        });
    },

    getCandidates: function( searchString )
    {
        "use strict";

        var queryUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&maxResults=50&order=relevance&type=video&q=" + encodeURIComponent( searchString );
        if ( this.hatchet )
        {
            queryUrl += "&videoEmbeddable=true";
        }
        var that = this;
        return Tomahawk.get( queryUrl ) .then(function( resp ){
            var results = [];
            if ( resp.pageInfo.totalResults !== 0 )
            {
                var total = resp.items.length;
                for ( var i = 0; i < total; i++ )
                {
                    if ( resp.items[i] === undefined )
                    {
                        continue;
                    }
                    if ( resp.items[i].id === undefined || resp.items[i].id.videoId === undefined )
                    {
                        continue;
                    }
                    if ( resp.items[i].snippet === undefined || resp.items[i].snippet.title === undefined || resp.items[i].snippet.description === undefined )
                    {
                        continue;
                    }
                    // Dirty check, filters out the most of the unwanted results
                    var searchFoundItem = resp.items[i].snippet.title.replace( /([^A-Za-z0-9\s])/gi, "" ).replace( /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'' ).replace( /\s+/g,'|' );
                    var searchStringItem = searchString.replace( /([^A-Za-z0-9\s])/gi, "" ).replace( /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'' ).replace( /\s+/g,'|' );
                    var matches = searchFoundItem.match( RegExp( searchStringItem, "gi" ) );
                    if ( !matches )
                    {
                        continue;
                    }
                    var track = resp.items[i].snippet.title;
                    var parsedTrack = that.cleanupAndParseTrack( track, searchString );
                    
                    if ( !parsedTrack || parsedTrack.artist === undefined || parsedTrack.track === undefined )
                    {
                        continue;
                    }
                    var result = {};
                    result.artist = parsedTrack.artist;
                    result.track = parsedTrack.track;
                    result.youtubeVideoId = resp.items[i].id.videoId;
                    result.year = resp.items[i].snippet.publishedAt.slice( 0, 4 );
                    result.linkUrl = "https://www.youtube.com/watch?v=" + result.youtubeVideoId;
                    result.mimetype = "video/h264";
                    result.score = (parsedTrack.isOfficial === 1 ? 0.80 : 0.65);
                    results.push( result );
                }
            }
            if ( results.length === 0 )
            {
                return results;
            }
            else
            {
                return that.verify( results );
            }
        } );
    },

    verify: function( candidates )
    {
        "use strict";

        var that = this;
        RSVP.Promise.all(candidates.map( function( candidate ){
            var trackLookupUrl = "http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=b14d61bf2f7968731eb686c7b4a1516e&format=json&limit=5&artist=" + encodeURIComponent( candidate.artist ) + "&track=" + encodeURIComponent( candidate.track );
            return Tomahawk.get( trackLookupUrl).then(function( response ){
                if ( response.track !== undefined && response.track.name !== undefined && response.track.artist.name !== undefined )
                {
                    if ( response.track.name.toLowerCase() === candidate.track.toLowerCase() && response.track.artist.name.toLowerCase() === candidate.artist.toLowerCase() )
                    {
                        return candidate;
                    }
                }
                else
                {
                    if( response.track !== undefined )
                    {
                        that.debugMsg( "Bad track name? " + trackLookupUrl + ": " + JSON.stringify( response.track ) );
                    }
                    else
                    {
                        that.debugMsg( "Bad result from track lookup? " + trackLookupUrl + ": " + JSON.stringify( response ) );
                    }
                }
            } );
        } )).then(function(results) {
            return that.getMetadata( verified.filter(function(e) { return e !== undefined; } ));
        });
    },

    getMetadata: function( results )
    {
        "use strict";
        
        var queryUrl = "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&id=";
        var params = {
            part : 'contentDetails',
            id   : results.map(function(r) { return r.youtubeVideoId; }).join(','),
        };
        var that = this;
        return that.apiCall('videos', params).then(function( response ){
            results.forEach( function( result ){
                for ( var i = 0; i < response.items.length; i++ )
                {
                    if ( response.items[i].id === result.youtubeVideoId )
                    {
                        result.name = that.settings.name;
                        result.duration = that.iso8601toSeconds( response.items[i].contentDetails.duration );
                    }
                }
            } );
            return that.parseVideoUrlFromYtPages( results );
        } );
    },

    parseVideoUrlFromYtPages: function( results )
    {
        "use strict";
        Tomahawk.log('parse videourlfrompages');

        var that = this;
        return RSVP.Promise.all(results.map( function( result ){
            return Tomahawk.get( result.linkUrl).then(function( html ){
                var url;
                var parsed;
                // Now we can go further down, and check the ytplayer.config map
                var streamMatch = html.match( /(ytplayer\.config =)([^\r\n]+?\});/ );
                if ( !streamMatch )
                {
                    // Todo: Open window for user input?
                    var dasCaptcha = html.match( /www.google.com\/recaptcha\/api\/challenge?/i );
                    if ( dasCaptcha )
                    {
                        that.debugMsg( "Failed to parse url from youtube page. Captcha limitation in place." );
                    }
                    else
                    {
                        that.debugMsg( "Failed to find stream_map in youtube page." );
                    }
                }
                if ( streamMatch && streamMatch[2] !== undefined )
                {
                    try {
                        var jsonMap = JSON.parse( streamMatch[2] );
                        if ( jsonMap.args.url_encoded_fmt_stream_map !== undefined )
                        {
                            parsed = that.parseURLS( jsonMap.args.url_encoded_fmt_stream_map, html );
                            if ( parsed )
                            {
                                url = parsed;
                            }
                        }
                        else 
                            that.debugMsg('NOOOO ' + jsonMap.args.video_id);
                    }
                    catch ( e ) {
                        that.debugMsg( "Critical: " + e );
                    }
                }
                if ( url )
                {
                    return RSVP.Promise.all([url, result]).then(function(data){
                        var url    = data[0];
                        var result = data[1];
                        result.url = url.url;
                        result.mimetype = url.mime;
                        result.bitrate = that.getBitrate( url.itag );
                        var expires = url.url.match( /expire=([0-9]+)(?=(&))/ );
                        if ( expires && expires[1] !== undefined )
                            expires = expires[1];
                        else
                            expires = url.expires;
                        if ( expires )
                        {
                            result.expires = Math.floor( expires );
                        }
                        return result;
                    });
                }
            } );
        } )).then(function(results) {
            if ( that.resolveMode )
            {
                return [that.getMostRelevant( results )];
            }
            return results;
        });
    },

    search: function( params )
    {
        "use strict";

        return getCandidates( params.query );
    }
} );

Tomahawk.resolver.instance = YoutubeResolver;
