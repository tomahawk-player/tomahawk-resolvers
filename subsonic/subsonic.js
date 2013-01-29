
var SubsonicResolver = Tomahawk.extend(TomahawkResolver, {

    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [{
                name: "user",
                widget: "user_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }, {
                name: "subsonic_url",
                widget: "subsonic_url_edit",
                property: "text"
            }, {
                name: "subsonic_api",
                widget: "api_version_combo",
                property: "currentIndex"
            }, {
                name: "max_songs",
                widget: "max_songs_spinbox",
                property: "value"
            }],
            images: [{
                "subsonic.png" : Tomahawk.readBase64("subsonic.png")
            }]
        };
    },

    newConfigSaved: function () {
        var userConfig = this.getUserConfig();
        Tomahawk.log("newConfigSaved User: " + userConfig.user);

        if (this.user !== userConfig.user ||
            this.password !== userConfig.password ||
            this.subsonic_url !== userConfig.subsonice_url ||
            this.subsonic_api !== userConfig.subsonic_api ||
            this.max_songs !== userConfig.max_songs)
        {
            this.init();
        }
    },

    settings:
    {
        name: 'Subsonic',
        icon: 'subsonic-icon.png',
        weight: 70,
        timeout: 8
    },

    encodePassword : function(password)
    {
        var hex_slice;
        var hex_string = "";
        var padding = [ "", "0", "00" ];
        for (pos = 0; pos < password.length; hex_string += hex_slice)
        {
            hex_slice = password.charCodeAt(pos++).toString(16);
            hex_slice = hex_slice.length < 2 ? (padding[2 - hex_slice.length] + hex_slice) : hex_slice;
        }
        return "enc:" + hex_string;
    },

    init: function()
    {
        var userConfig = this.getUserConfig();
        if (!userConfig.user || !userConfig.password) {
            Tomahawk.log("Subsonic Resolver not properly configured!");
            return;
        }

        Tomahawk.log("Doing Subsonic resolver init, got credentials from config.  User: " + userConfig.user);
        this.user = userConfig.user;
        var enc_password = this.encodePassword(userConfig.password);
        this.password = enc_password;
        this.subsonic_url = userConfig.subsonic_url.replace(/\/+$/, "");
        this.subsonic_api = userConfig.subsonic_api;
        this.max_songs = userConfig.max_songs;
    },

    getXmlAttribute: function(attrib_name, attributes)
    {
        for (var count = 0; count < attributes.length; ++count)
        {
            if (attrib_name === attributes[count].nodeName)
                return attributes[count].nodeValue;
        }
        return null;
    },

    buildBaseUrl : function(subsonic_view)
    {
        var supported_api_versions = [ "1.6.0", "1.7.0", "1.8.0" ];

        return this.subsonic_url + subsonic_view +
                "?u=" + this.user +
                "&p=" + this.password +
                "&v=" + supported_api_versions[ this.subsonic_api ] +
                "&c=tomahawk";
    },

    parseSongFromXmlAttributes : function(song_attributes)
    {
        return {
            artist: this.getXmlAttribute("artist", song_attributes),
            album: this.getXmlAttribute("album", song_attributes),
            track: this.getXmlAttribute("title", song_attributes),
            albumpos: this.getXmlAttribute("track", song_attributes),
            source: this.settings.name,
            size: this.getXmlAttribute("size", song_attributes),
            duration: this.getXmlAttribute("duration", song_attributes),
            bitrate: this.getXmlAttribute("bitRate", song_attributes),
            url: this.buildBaseUrl("/rest/stream.view") + "&id=" + this.getXmlAttribute("id", song_attributes),
            extension: this.getXmlAttribute("suffix", song_attributes),
            year: this.getXmlAttribute("year", song_attributes)
        };
    },


    parseSongFromAttributes : function(song_attributes)
    {
        return {
            artist:     song_attributes["artist"],
            album:      song_attributes["album"],
            track:      song_attributes["title"],
            albumpos:   song_attributes["track"],
            source:     this.settings.name,
            size:       song_attributes["size"],
            duration:   song_attributes["duration"],
            bitrate:    song_attributes["bitRate"],
            url:        this.buildBaseUrl("/rest/stream.view") + "&id=" + song_attributes["id"],
            extension:  song_attributes["suffix"],
            year:       song_attributes["year"],
        };
    },

    executeSearchQuery : function(qid, search_url, song_xml_tag, limit)
    {
        var results = [];
        var that = this; // needed so we can reference this from within the lambda

        // Important to recognize this async request is doing a get and the user / password is passed in the search url
        // TODO: should most likely just use the xhr object and doing basic authentication.
        Tomahawk.asyncRequest(search_url, function(xhr) {
            var dom_parser = new DOMParser();
            xmlDoc = dom_parser.parseFromString(xhr.responseText, "text/xml");

            var search_results = xmlDoc.getElementsByTagName(song_xml_tag);
            Tomahawk.log(search_results.length + " results returned.")
            for (var count = 0; count < Math.min(search_results.length, limit); count++)
            {
                results.push(that.parseSongFromXmlAttributes(search_results[count].attributes));
            }

            var return_songs = {
                qid: qid,
                results: results
            };

            Tomahawk.addTrackResults(return_songs);
        });
    },

    executeArtistsQuery : function(qid, artists_url)
    {
        var results = [];
        artists_url += "&f=json"; //for large responses we surely want JSON

        // Important to recognize this async request is doing a get and the user / password is passed in the search url
        // TODO: should most likely just use the xhr object and doing basic authentication.
        Tomahawk.asyncRequest(artists_url, function(xhr) {
            var doc = JSON.parse(xhr.responseText);
            Tomahawk.log("subsonic artists query:" + artists_url);
            Tomahawk.log("subsonic artists response:" + xhr.responseText);
            var artists = doc["subsonic-response"].artists.index;

            for (var i = 0; i < artists.length; i++)
            {
                if ( artists[i].artist instanceof Array )
                {
                    for (var j = 0; j < artists[i].artist.length; j++)
                    {
                        results.push( artists[i].artist[j].name)
                    }
                }
                else
                {
                    results.push( artists[i].artist.name )
                }
            }

            var return_artists = {
               qid: qid,
               artists: results
            };

            Tomahawk.log("subsonic artists about to return: " + JSON.stringify( return_artists ) );
            Tomahawk.addArtistResults(return_artists);
        });
    },

    executeAlbumsQuery : function(qid, search_url, artist)
    {
        var results = [];
        search_url += "&f=json"; //for large responses we surely want JSON

        // Important to recognize this async request is doing a get and the user / password is passed in the search url
        // TODO: should most likely just use the xhr object and doing basic authentication.
        Tomahawk.asyncRequest(search_url, function(xhr) {
            var doc = JSON.parse(xhr.responseText);
            Tomahawk.log("subsonic albums query:" + search_url);
            Tomahawk.log("subsonic albums response:" + xhr.responseText);
            var albums = doc["subsonic-response"].searchResult2.album;

            if (albums instanceof Array)
            {
                Tomahawk.log(albums.length + " albums returned.")
                for (var i = 0; i < albums.length; i++)
                {
                    if (albums[i].artist.toLowerCase() === artist.toLowerCase()) //search2 does partial matches
                    {
                        results.push(albums[i].title)
                    }
                }
            }
            else
            {
                if (albums.artist.toLowerCase() === artist.toLowerCase())
                {
                    results.push(albums.title);
                }
            }

            var return_albums = {
                qid: qid,
                artist: artist,
                albums: results
            };

            Tomahawk.log("subsonic albums about to return: " + JSON.stringify( return_albums ) );
            Tomahawk.addAlbumResults(return_albums);
        });
    },

    executeTracksQuery : function(qid, search_url, artist, album)
    {
        var results = [];
        var that = this;
        search_url += "&f=json"; //for large responses we surely want JSON

        // Important to recognize this async request is doing a get and the user / password is passed in the search url
        // TODO: should most likely just use the xhr object and doing basic authentication.
        Tomahawk.asyncRequest(search_url, function(xhr) {
            var doc = JSON.parse(xhr.responseText);
            Tomahawk.log("subsonic tracks query:" + search_url);
            Tomahawk.log("subsonic tracks response:" + xhr.responseText);
            var tracks = doc["subsonic-response"].searchResult.match;

            if (tracks instanceof Array)
            {
                Tomahawk.log(tracks.length + " tracks returned.")
                for (var i = 0; i < tracks.length; i++ )
                {
                    Tomahawk.log("tracks[i].artist=" + tracks[i].artist);
                    Tomahawk.log("artist=          " + artist);
                    Tomahawk.log("tracks[i].album =" + tracks[i].album);
                    Tomahawk.log("album=           " + album);

                    if (tracks[i].artist.toLowerCase() === artist.toLowerCase() && tracks[i].album.toLowerCase() === album.toLowerCase())
                    {
                        results.push(that.parseSongFromAttributes(tracks[i]));
                    }
                }
            }
            else
            {
                if (tracks.artist.toLowerCase() === artist.toLowerCase() && tracks.album.toLowerCase() === album.toLowerCase())
                {
                    results.push(that.parseSongFromAttributes(tracks));
                }
            }

            var return_tracks = {
                qid: qid,
                artist: artist,
                album: album,
                results: results
            };

            Tomahawk.log("subsonic tracks about to return: " + JSON.stringify( return_tracks ) );
            Tomahawk.addAlbumTrackResults(return_tracks);
        });
    },

    //! Please note i am using the deprecated search method in resolve
    //  The reason i am doing this is because it allows me to get a little more specific with the search
    //  since i have the artist, album and title i want to be as specific as possible
    //  NOTE: I do use the newer search2.view in the search method below and it will populate each result with the
    //  appropriate url.
    resolve: function(qid, artist, album, title)
    {
        if (this.user === undefined || this.password === undefined || this.subsonic_url === undefined)
            return { qid: qid, results: [] };

        var search_url = this.buildBaseUrl("/rest/search.view") + "&artist=" + artist + "&album=" + album + "&title=" + title + "&count=1";
        this.executeSearchQuery(qid, search_url, "match", 1);
    },

    search: function( qid, searchString )
    {
        if (this.user === undefined || this.password === undefined || this.subsonic_url === undefined)
            return { qid: qid, results: [] };

        var search_url = this.buildBaseUrl("/rest/search2.view") + "&songCount=" + this.max_songs + "&query=\"" + encodeURIComponent(searchString) + "\"";
        this.executeSearchQuery(qid, search_url, "song", this.max_songs);
    },

    capabilities: function()
    {
        return TomahawkResolverCapability.Browsable | TomahawkResolverCapability.AccountFactory;
    },

    artists: function( qid )
    {
        if (this.user === undefined || this.password === undefined || this.subsonic_url === undefined)
            return { qid: qid, artists: [] };

        var artists_url = this.buildBaseUrl("/rest/getArtists.view");
        this.executeArtistsQuery(qid, artists_url);
    },

    albums: function( qid, artist )
    {
        if (this.user === undefined || this.password === undefined || this.subsonic_url === undefined)
            return { qid: qid, artist: artist, albums: [] };

        var search_url = this.buildBaseUrl("/rest/search2.view") + "&songCount=0&artistCount=0&albumCount=900" +
                "&query=\"" + encodeURIComponent(artist) + "\"";
        this.executeAlbumsQuery(qid, search_url, artist);
    },

    tracks: function( qid, artist, album )
    {
        if (this.user === undefined || this.password === undefined || this.subsonic_url === undefined)
            return { qid: qid, artist: artist, album: album, tracks: [] };

        // See note for resolve() about the search method
        var search_url = this.buildBaseUrl("/rest/search.view") +
                "&artist=\"" + encodeURIComponent(artist) +
                "\"&album=\"" + encodeURIComponent(album) + "\"&count=200";

        this.executeTracksQuery(qid, search_url, artist, album);
    }
});

Tomahawk.resolver.instance = SubsonicResolver;
