var GroovesharkResolver = Tomahawk.extend(TomahawkResolver, {
    secret: "499ca17500cd8e20afb1613c2d264e7e",
    apiKey: "tomahawkplayer",
    sessionId: "",
    streamKeys: [],
    ip: "",

    settings: {
        name: 'Grooveshark',
        weight: 30,
        timeout: 20
    },
    getConfigUi: function () {
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
            }, ],
            images: [{
                "grooveshark.png": Tomahawk.readBase64("grooveshark.png")
            }, ]
        };
    },
    newConfigSaved: function () {
        var userConfig = this.getUserConfig();
        if ((userConfig.username != this.username) || (userConfig.password != this.password)) {
            this.username = userConfig.username;
            this.password = userConfig.password;

            this.init();
        }
    },
    getClientIP: function() {
        var that = this;
        Tomahawk.asyncRequest( "http://jsonip.appspot.com/", function(xhr) {
            var result = JSON.parse(xhr.responseText);
            if (result.ip) {
                that.ip = result.ip;
            }
        });
    },
    apiCallSync: function (methodName, args) {
        var payload = {
            method: methodName
        };
        payload.header = {
            wsKey: this.apiKey
        }
        if (this.sessionId != "") {
            payload.header.sessionID = this.sessionId;
        }
        payload.parameters = args;

        var json = JSON.stringify(payload);
        var sig = Tomahawk.hmac(this.secret, json);
        var url = "https://api.grooveshark.com/ws/3.0/?sig=" + sig;
        
        var xmlHttpRequest = new XMLHttpRequest();
        xmlHttpRequest.open('POST', url, false);
        xmlHttpRequest.setRequestHeader("Content-Type", "application/octet-stream");
//         Tomahawk.log("Post Body: " + body);
        xmlHttpRequest.send(json);
        if (xmlHttpRequest.status == 200) {
            return xmlHttpRequest.responseText;
        } else {
            Tomahawk.log("Failed to do SYNCHRONOUS POST request: to: " + url + " and with body: " + json);
            Tomahawk.log("Status Code was: " + xmlHttpRequest.status);
        }
    },
    
    apiCall: function (methodName, args, callback) {
        var payload = {
            method: methodName
        };
        payload.header = {
            wsKey: this.apiKey
        }
        if (this.sessionId != "") {
            payload.header.sessionID = this.sessionId;
        }
        payload.parameters = args;

        var json = JSON.stringify(payload);
        var sig = Tomahawk.hmac(this.secret, json);
        var url = "https://api.grooveshark.com/ws/3.0/?sig=" + sig;
        this.doPost(url, json, callback);
    },
    doPost: function (url, body, callback) {
        var xmlHttpRequest = new XMLHttpRequest();
        //Tomahawk.log("DOing post:" + url + ", with body:" + body);
        xmlHttpRequest.open('POST', url, true);
        xmlHttpRequest.setRequestHeader("Content-Type", "application/octet-stream");
        xmlHttpRequest.setRequestHeader("X-Client-IP", this.ip);
        xmlHttpRequest.onreadystatechange = function () {

            if (xmlHttpRequest.readyState == 4 && xmlHttpRequest.status == 200) {
                callback.call(window, xmlHttpRequest);
            } else if (xmlHttpRequest.readyState === 4) {
                Tomahawk.log("Failed to do POST request: to: " + url + " and with body: " + body);
                Tomahawk.log("Status Code was: " + xmlHttpRequest.status);
                if (this.sessionId) { // if an error occurred, try re-fetching session id once
                    this.getSessionId();
                }
            }
        }
//         Tomahawk.log("Post Body: " + body);
        xmlHttpRequest.send(body);
    },

    init: function () {
        var userConfig = this.getUserConfig();
        if (!userConfig.username || !userConfig.password) {
            Tomahawk.log("Grooveshark Resolver not properly configured!");
            return;
        }
        this.username = userConfig.username;
        this.password = userConfig.password;

        this.sessionId = window.localStorage['sessionId'];
        this.countryId = window.localStorage['countryId'];

        this.getClientIP();

        Tomahawk.addCustomUrlHandler( "groove", "getStreamUrl" );
        
        if (!this.sessionId) {
            this.getSessionId();
        } else if (!this.countryId) {
            this.getCountry();
        }
    },

    getSessionId: function () {
        var that = this;
        this.apiCall("startSession", [], function (xhr) {
            var res = JSON.parse(xhr.responseText);
            if (res.result.success) {
                that.sessionId = res.result.sessionID;
                window.localStorage['sessionId'] = that.sessionId;
                that.authenticate();
            } else {
                Tomahawk.log("Not able to get session id.. " + xhr.responseText);
            }
        });
    },
    authenticate: function () {
        var params = {
            login: this.username,
            password: Tomahawk.md5(this.password)
        };
        var that = this;
        this.apiCall("authenticate", params, function (xhr) {
            //Tomahawk.log("Got result of authenticate: " + xhr.responseText);
            var ret = JSON.parse(xhr.responseText);
            if (ret.result.success) {
                if (!ret.result.IsAnywhere) {
                    alert("Tomahawk requires a Grooveshark Anywhere account!");
                    return;
                } else if (!this.countryId) {
                    that.getCountry();
                }
            }
        });
    },

    getCountry: function () {
        this.apiCall('getCountry', [], function (xhr) {
            var ret = JSON.parse(xhr.responseText);
            this.countryId = JSON.stringify(ret.result);
            Tomahawk.log("Got country id: " + this.countryId);
            window.localStorage['countryId'] = this.countryId;

            // Finally ready
        });
    },

    getStreamUrl: function (ourUrl) {
        var songId = ourUrl.replace("groove://", "");
        
        //Tomahawk.log("Got factory function called to get grooveshark streaming url from:" + ourUrl + " and songId:" + songId);
        var params = {
            songID: songId,
            country: JSON.parse(this.countryId),
            lowBitrate: 0
        };
        
        var streamResult = this.apiCallSync('getSubscriberStreamKey', params );
        //Tomahawk.log("Got song stream server: " + streamResult);
        var ret = JSON.parse(streamResult);
        if (ret.errors) {
            Tomahawk.log("Got error doing getSubscriberStreamKey api call: " + streamResult);
        } else {
            var url = unescape(ret.result.url);
            Tomahawk.log("Found MP3 URL: " + ret.result.url);
            this.streamKeys[songId] = ret.result.StreamKey;

            return url;
        }
        
        return "";
    },

    resolve: function (qid, artist, album, title) {
        if (!this.countryId) {
            return;
        }

        var params = {
            query: title,
            country: this.countryId,
            limit: 10
        };
        var that = this;
        this.apiCall("getSongSearchResults", params, function (xhr) {
            //Tomahawk.log("Got song search results: " + xhr.responseText);
            var ret = JSON.parse(xhr.responseText);
            if (!ret || !ret.result || !ret.result.songs) return;
            var songs = ret.result.songs;
            var results = []

            if (songs.length === 0) return;

            for (var i = 0; i < songs.length; i++) {
                var song = songs[i];
                var songResult = {
                    artist: song.ArtistName,
                    album: song.AlbumName,
                    track: song.SongName,
                    source: that.settings.name,
                    url: "groove://" + song.SongID,
                    mimetype: 'audio/mpeg',
                    duration: ret.result.uSecs / 1000000,
                    // score: Tomahawk.valueForSubNode(song, "rating")
                }
                results.push(songResult);
            }
            var toReturn = {
                results: results,
                qid: qid
            };
            Tomahawk.addTrackResults(toReturn);
        });
    },
    search: function (qid, searchString) {
        //TODO
    }
});

Tomahawk.resolver.instance = GroovesharkResolver;
