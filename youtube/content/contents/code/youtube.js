/*
 * Copyright (C) 2012 Hugo Lindström <hugolm84@gmail.com>
 * Copyright (C) 2011-2015 Thierry Göckel <thierry@strayrayday.lu>
 * Copyright (C) 2012 Leo Franchi <lfranchi@kde.org>
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

var YoutubeResolver = Tomahawk.extend( TomahawkResolver, {

    settings: {
        name: 'YouTube',
        icon: 'youtube-icon.png',
        weight: 70,
        timeout: 15
    },

    hatchet: false,

    resolveMode: false,

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

    sendEmptyResult: function( qid )
    {
        "use strict";

        var empty = {
            results: [],
            qid: qid
        };
        Tomahawk.addTrackResults( empty );
    },

    // Allows async requests being made with userdata
    asyncRequest: function ( url, userdata, callback )
    {
        "use strict";

        Tomahawk.asyncRequest( url, function ( xhr ) {
            callback.call( window, xhr, userdata );
        } );
    },

    debugMsg: function( msg )
    {
        "use strict";

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

        var best = results.length;
        var finalResult = results[0];
        for ( var j = 0; j < results.length; j++ )
        {
            if ( results[j].id < best || ( results[j].url && this.hasPreferredQuality( results[j].url, results[j].YouTubeQuality ) ) )
            {
                best = results[j].id;
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

    getBitrate: function ( result )
    {
        "use strict";

        var urlString = result.url;
        //http://www.h3xed.com/web-and-internet/youtube-audio-quality-bitrate-240p-360p-480p-720p-1080p
        // No need to get higher than hd720, as it only will eat bandwith and do nothing for sound quality
        if ( urlString.indexOf( "quality=hd720" ) !== -1 || result.quality === 'hd720' )
        {
            return 192;
        }
        else if ( urlString.indexOf( "quality=medium" ) !== -1 || result.quality === 'medium' )
        {
            return 128;
        }
        else if ( urlString.indexOf( "quality=small" ) !== -1 || result.quality === 'medium' )
        {
            return 96;
        }
        // Probably
        return 128;
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
                result.parsed = this.parseCleanTrack( title.replace( RegExp( searchString, "gi" ), searchString.concat( " :" ) ) );
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

    _extract_object : function( code, name, known_objects ) {
        //For now objects we need to extract were always self contained so we
        //just regex-extract it and return
        Tomahawk.log('Extracting object:' + name);
        var objectRE = new RegExp('(?:var\\s+)?' +
                name + '\\s*=\\s*\\{\\s*(([a-zA-Z$0-9]+\\s*:\\s*function\\(.*?\\)\\s*\\{.*?\\})*)\\}\\s*;');
        var obj_M = code.match(objectRE);
        return obj_M[0];
    },

    _extract_function : function( code, name, known_objects ) {
        Tomahawk.log('Extracting function:' + name);
        var functionCode = '';
        if (typeof known_objects === 'undefined')
        {
            known_objects = {
                names: [ name ]
            };
        }
        var f_RE = new RegExp('(?:function\\s+' + name + '|[{;\\s]' +
            name + '\\s*=\\s*function)\\s*\\(([^)]*)\\)\\s*\\{([^}]+)\\}');
        Tomahawk.log('(?:function\\s+' + name + '|[{;]' +
            name + '\\s*=\\s*function)\\s*\\(([^)]*)\\)\\s*\\{([^}]+)\\}');
        var f_match = code.match(f_RE);
        if ( f_match )
        {
            Tomahawk.log('Args for function ' + name + ' is: ' + f_match[1]);
            Tomahawk.log('Body for function ' + name + ' is: ' + f_match[2]);
            var args = f_match[1].split(',');
            known_objects.names = known_objects.names.concat(args);
            Tomahawk.log(JSON.stringify(known_objects));
            var statements = f_match[2].split(';');
            for(var i = 0; i < statements.length; i++)
            {
                var stmt = statements[i].trim();
                var callRE = /(?:^|[=\+-\s]+)([a-zA-Z\.]+)\s*\(/gm;
                var match;
                Tomahawk.log('Processing stmt:' + stmt);
                while ((match = callRE.exec(stmt)) !== null)
                {
                    Tomahawk.log('Processing call:' + match[1]);
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
                        Tomahawk.log('see if object is known:' + split[0]);
                        Tomahawk.log(known_objects.names.indexOf(split[0]));
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
        var urlArray = rawUrls.split( /,/g );
        for ( var i = 0; i < urlArray.length; i++ )
        {
            var params = this._parseQueryString(urlArray[i]);

            //Without the following it'll give 403 for Tomahawk's user-agent
            //(even though URL will work with anything else just fine)
            //This is some bullshit black magic ... 
            params.url = decodeURIComponent(params.url);

            var haveSignature = params.url.indexOf('signature=') !== -1;

            if (params.sig) {
                haveSignature = true;
                params.url += '&signature=' + params.sig;
            } else if (params.s) {
                //lets try to extract deobfuscation function automatically
                //URL list for future testing, please append the new ones so
                //that if anything breaks we can make sure our code works on
                //all variants we have seen so far
                //  s.ytimg.com/yts/jsbin/html5player-new-en_US-vflOWWv0e/html5player-new.js
                //
                var ASSETS_RE = /"assets":.+?"js":\s*("[^"]+")/;
                var assetsMatch = html.match( ASSETS_RE );
                if ( assetsMatch )
                {
                    Tomahawk.log('yt player js: ' + JSON.parse(assetsMatch[1]));
                    var js_player_url = JSON.parse(assetsMatch[1]);
                    if (js_player_url.indexOf('//') === 0)
                        js_player_url = 'https:' + js_player_url;
                    if (js_player_url in that.deobfuscateFunctions)
                    {
                        var dec = that.deobfuscateFunctions[js_player_url];

                        haveSignature = true;
                        params.url += '&signature=' + eval(dec.code + dec.name + '("' + params.s + '");');
                    } else {
                        //TODO: this result will be abandoned ... only the
                        //subsequent ones coming after we got the function will
                        //succeed ... need to delat them, requires a bit of
                        //refactoring
                        Tomahawk.get(js_player_url).then(function (code) {
                            //Extract top signature deobfuscation function name
                            var decrypt_function_RE = /\.sig\|\|([a-zA-Z0-9$]+)\(/;
                            var fname = code.match( decrypt_function_RE );
                            if ( fname )
                        {
                            fname = fname[1];
                            Tomahawk.log('Deobfuscate function name: ' + fname);
                            var func = that._extract_function(code, fname);
                            Tomahawk.log('Extracted deobfuscation code is:' + func);
                            that.deobfuscateFunctions[js_player_url] = {
                                code : func,
                                name : fname
                            };
                        }
                        });
                    }
                }
            }

            //This resolver relies heavily on having quality as part of the url
            if ( haveSignature && ['hd270','high','medium','small'].indexOf(params.quality) !== -1 ||
                 params.url.regexIndexOf( /quality=(hd720|high|medium|small)/i, 0 ) !== -1)
            {
                parsedUrls.push( 
                    {
                        url: params.url,
                        quality: params.quality
                    }
                    );
            }
        }

        var finalUrl;

        if ( this.qualityPreference === undefined )
        {
            // This shouldnt happen really, but sometimes do?!
            this.qualityPreference = 0;
            this.debugMsg( "Critical: Failed to set qualitypreference in init, resetting to " + this.qualityPreference );
        }

        for ( i = 0; i < parsedUrls.length; i++ )
        {
            if ( this.hasPreferredQuality( parsedUrls[i].url,  parsedUrls[i].quality ) )
            {
                finalUrl = parsedUrls[i];
            }
        }

        if ( finalUrl === undefined )
        {
            finalUrl = parsedUrls[0];
        }

        if ( finalUrl && finalUrl !== undefined )
        {
            return finalUrl;
        }
        return null;
    },

    resolve: function( qid, artist, album, title )
    {
        "use strict";

        this.resolveMode = true;
        var query;
        if ( artist !== "" )
        {
            query = encodeURIComponent( artist ) + "%20";
        }
        if ( title !== "" )
        {
            query += encodeURIComponent( title );
        }
        var apiQuery = "https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&maxResults=10&order=relevance&type=video&q=" + query.replace( /\%20/g, '+' );
        if ( this.hatchet )
        {
            apiQuery += "&videoEmbeddable=true";
        }
        var that = this;
        Tomahawk.asyncRequest( apiQuery, function( xhr ) {
            var resp = JSON.parse( xhr.responseText );
            if ( resp.pageInfo.totalResults !== 0 && resp.items !== undefined )
            {
                var results = [];
                var limit = Math.min( 10, resp.pageInfo.totalResults );
                //Lets fetch page for first result, usually if Google detected
                //a proper track there it'll be in description with links to
                //amazon/itunes/google stores. That would be the best result
                //tbh
                Tomahawk.get('https://www.youtube.com/watch?v=' + resp.items[0].id.videoId).then(function(page){
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
                        var responseItem = resp.items[0];
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

                        if ( that.qualityPreference === 0 )
                        {
                            result.linkUrl += "&hd=1";
                        }
                        results.push( result );
                    }
                    for ( var i = startIndex; i < limit; i++ )
                    {
                        var responseItem = resp.items[i];
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
                            if ( that.qualityPreference === 0 )
                            {
                                result.linkUrl += "&hd=1";
                            }
                            results.push( result );
                        }
                    }
                    if (results.length === 0) { // if no results had appropriate titles, return empty
                        that.sendEmptyResult( qid, artist + " - " + title );
                    }
                    else
                    {
                        if ( that.hatchet )
                        {
                            Tomahawk.addTrackResults( { qid: qid, results: [that.getMostRelevant( results )] } );
                        }
                        else
                        {
                            that.getMetadata( qid, results );
                        }
                    }
                });
            }
            else
            {
                that.sendEmptyResult( qid, artist + " - " + title );
            }
        });
    },

    getCandidates: function( qid, searchString )
    {
        "use strict";

        var queryUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&maxResults=50&order=relevance&type=video&q=" + encodeURIComponent( searchString ).replace( /\%20/g, '+' );
        if ( this.hatchet )
        {
            queryUrl += "&videoEmbeddable=true";
        }
        var that = this;
        Tomahawk.asyncRequest( queryUrl, function( xhr ){
            var resp = JSON.parse( xhr.responseText );
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
                    result.score = (parsedTrack.isOfficial !== undefined ? 0.85 : 0.95);
                    results.push( result );
                }
            }
            if ( results.length === 0 )
            {
                that.sendEmptyResult( qid, searchString );
            }
            else
            {
                that.verify( qid, results );
            }
        } );
    },

    verify: function( qid, candidates )
    {
        "use strict";

        var verified = [];
        var total = candidates.length;
        var that = this;
        candidates.forEach( function( candidate ){
            var trackLookupUrl = "http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=b14d61bf2f7968731eb686c7b4a1516e&format=json&limit=5&artist=" + encodeURIComponent( candidate.artist ) + "&track=" + encodeURIComponent( candidate.track );
            Tomahawk.asyncRequest( trackLookupUrl, function( xhr ){
                var response = JSON.parse( xhr.responseText );
                if ( response.track !== undefined && response.track.name !== undefined && response.track.artist.name !== undefined )
                {
                    if ( response.track.name.toLowerCase() === candidate.track.toLowerCase() && response.track.artist.name.toLowerCase() === candidate.artist.toLowerCase() )
                    {
                        verified.push( candidate );
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
                total--;
                if ( total === 0 )
                {
                    that.getMetadata( qid, verified );
                }
            } );
        } );
    },

    getMetadata: function( qid, results )
    {
        "use strict";
        
        var queryUrl = "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&key=AIzaSyD22x7IqYZpf3cn27wL98MQg2FWnno_JHA&id=";
        results.forEach( function( result ){
            queryUrl += result.youtubeVideoId + ",";
        } );
        queryUrl = queryUrl.substring( 0, queryUrl.length - 1 );
        var that = this;
        Tomahawk.asyncRequest( queryUrl, function( xhr ){
            var response = JSON.parse( xhr.responseText );
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
            that.parseVideoUrlFromYtPages( qid, results );
        } );
    },

    parseVideoUrlFromYtPages: function( qid, results )
    {
        "use strict";

        var that = this;
        var total = results.length;
        results.forEach( function( result ){
            Tomahawk.asyncRequest( result.linkUrl, function( xhr ){
                var html = xhr.responseText;
                var url;
                // First, lets try and find the stream_map at top of the page
                // to save some time going to the end and do JSON.parse on the yt.config
                var streamMatch = html.match( /(url_encoded_fmt_stream_map=)(.*?)(?=(\\u0026amp))/i );
                var parsed;
                if ( streamMatch && streamMatch[2] !== undefined )
                {
                    parsed = this.parseURLS( streamMatch[2], html );
                    if ( parsed )
                    {
                        url = parsed;
                    }
                    else
                    {
                        this.debug( "Hm, failed to parse urls from top of the page" );
                    }
                }
                // Now we can go further down, and check the ytplayer.config map
                streamMatch = html.match( /(ytplayer\.config =)([^\r\n]+?\});/ );
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
                    }
                    catch ( e ) {
                        that.debugMsg( "Critical: " + e );
                    }
                }
                if ( url )
                {
                    result.url = url.url;
                    result.mimetype = url.mime;
                    result.bitrate = that.getBitrate( url );
                    result.YouTubeQuality = url.quality;
                    var expires = url.url.match( /expire=([0-9]+)(?=(&))/ );
                    if ( expires && expires[1] !== undefined )
                        expires = expires[1];
                    else
                        expires = url.expires;
                    if ( expires )
                    {
                        result.expires = Math.floor( expires );
                    }
                }
                total--;
                if ( total === 0 )
                {
                    var toReturn = {qid: qid, results: results};
                    if ( that.resolveMode )
                    {
                        toReturn.results = [that.getMostRelevant( results )];
                    }
                    Tomahawk.addTrackResults( toReturn );
                }
            } );
        } );
    },

    search: function( qid, searchString )
    {
        "use strict";

        this.getCandidates( qid, searchString );
    }
} );

Tomahawk.resolver.instance = YoutubeResolver;
