
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
                property: "currentText"
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
            this.subsonic_api !== userConfig.subsonic_api)
        {
            this.init();
        }
    },

    settings:
    {
        name: 'Subsonic',
        weight: 70,
        timeout: 15
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

    init: function() {
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
    },

    getXmlAttribute: function(attrib_name, attributes) {
        for (var count = 0; count < attributes.length; ++count)
        {
            if (attrib_name === attributes[count].nodeName)
                return attributes[count].nodeValue;
        }
        return null;
    },

    buildBaseUrl : function(subsonic_view)
    {
        var subsonic_api = this.subsonic_api;
        if (subsonic_view === "/rest/search.view")
        {
            subsonic_api = "1.4.0"; // please see comment on resolve
        }
        else
        {
            subsonic_api = this.subsonic_api;
        }
        var base_url = this.subsonic_url + subsonic_view + "?u=" + this.user + "&p=" + this.password + "&v=" + subsonic_api + "&c=tomahawk";
        return base_url;
    },

    parseSongFromAttributes : function(song_attributes)
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

    executeSearchQuery : function(qid, search_url, song_xml_tag, limit)
    {
        var results = [];
        var that = this; // needed so we can reference this from within the lambda

        // Important to recognize this async request is doing a get and the user / password is passed in the search url
        // TODO: should most likely just use the xhr object and doing basic authentication.
        Tomahawk.asyncRequest(search_url, function(xhr) {
            var dom_parser = new DOMParser();
            xmlDoc = dom_parser.parseFromString(xhr.responseText, "text/xml");
            Tomahawk.log(xhr.responseText);

            var search_results = xmlDoc.getElementsByTagName(song_xml_tag);
            for (var count = 0; count < Math.min(search_results.length, limit); count++)
            {
                results.push(that.parseSongFromAttributes(search_results[count].attributes));
            }

            var return_songs = {
                qid: qid,
                results: results
            };

            Tomahawk.addTrackResults(return_songs);
        });
    },

    //! Please note i am using the deprecated search method in resolve
    //  The reason i am doing this is because it allows me to get a little more specific with the search
    //  since i have the artist, album and title i want to be as specific as possible
    //  NOTE: I do use the newer search2.view in the search method below and it will populate each result with the
    //  appropriate url.
    resolve: function(qid, artist, album, title)
    {
        var search_url = this.buildBaseUrl("/rest/search.view") + "&artist=" + artist + "&album=" + album + "&title=" + title + "&count=1";
        this.executeSearchQuery(qid, search_url, "match", 1);
    },

    search: function( qid, searchString )
    {
        var search_url = this.buildBaseUrl("/rest/search2.view") + "&query=" + encodeURIComponent(searchString);
        this.executeSearchQuery(qid, search_url, "song", 20);
    }
});

Tomahawk.resolver.instance = SubsonicResolver;
