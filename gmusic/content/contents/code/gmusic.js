/* Google Play Music resolver for Tomahawk.
 *
 * Written in 2013 by Sam Hanes <sam@maltera.com>
 * Extensive modifications in 2014 by Lalit Maganti
 * Further modifications in 2014 by Enno Gottschalk <mrmaffen@googlemail.com>
 *
 * To the extent possible under law, the author(s) have dedicated all
 * copyright and related and neighboring rights to this software to
 * the public domain worldwide. This software is distributed without
 * any warranty.
 *
 * You should have received a copy of the CC0 Public Domain Dedication
 * along with this software. If not, see:
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

var GMusicResolver = Tomahawk.extend(Tomahawk.Resolver, {

    apiVersion: 0.9,

    settings: {
        name: 'Google Play Music',
        icon: '../images/icon.png',
        weight: 90,
        timeout: 8
    },

    _authUrl: 'https://android.clients.google.com/auth',
    _userAgent: 'tomahawk-gmusic-0.6.0',
    _baseURL: 'https://mclients.googleapis.com/sj/v2.5/',
    _webURL: 'https://play.google.com/music/',
    // Google Play Services key version 7.3.29:
    _googlePlayKey: "AAAAgMom/1a/v0lblO2Ubrt60J2gcuXSljGFQXgcyZWveWLEwo6prwgi3iJIZdodyhKZQrNWp5nKJ3"
    + "srRXcUW+F1BD3baEVGcmEgqaLZUNBjm057pKRI16kB0YppeGx5qIQ5QjKzsR8ETQbKLNWgRY0QRNVz34kMJR3P/LgHax"
    + "/6rmf5AAAAAwEAAQ==",

    getConfigUi: function () {
        return {
            "widget": Tomahawk.readBase64("config.ui"),
            fields: [{
                name: "email",
                widget: "email_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }],
            images: [{
                "play-logo.png": Tomahawk.readBase64("play-logo.png")
            }]
        };
    },

    /**
     * Defines this Resolver's config dialog UI.
     */
    configUi: [
        {
            type: "textview",
            text: "For this plug-in to work you must first login using the official Google Music "
            + "iOS or Android app and play a song. After you've done that Tomahawk should then be "
            + "able to authenticate with your account."
        },
        {
            type: "textview",
            text: "<html>Note: If you use 2-Step Verification, then you must create an "
            + "<a href=\"https://support.google.com/accounts/answer/185833?hl=en\">app-specific "
            + "password</a> to use in Tomahawk. Otherwise, make sure that you enable "
            + "\"less secure apps\" in your "
            + "<a href=\"https://www.google.com/settings/security/lesssecureapps\">Google account "
            + "settings</a></html>"
        },
        {
            id: "email",
            type: "textfield",
            label: "E-Mail"
        },
        {
            id: "password",
            type: "textfield",
            label: "Password",
            isPassword: true
        }
    ],

    newConfigSaved: function (newConfig) {
        if (this._email !== newConfig.email
            || this._password !== newConfig.password
            || this._token !== newConfig.token) {
            Tomahawk.log("Invalidating cache");
            var that = this;
            gmusicCollection.wipe({id: gmusicCollection.settings.id}).then(function () {
                window.localStorage.removeItem("gmusic_last_cache_update");
                that.init();
            });
        }
    },

    init: function () {
        var name = this.settings.name;
        var config = this.getUserConfig();
        if (!config.email || (!config.token && !config.password)) {
            Tomahawk.PluginManager.unregisterPlugin("collection", gmusicCollection);
            Tomahawk.log(name + " resolver not configured.");
            return;
        }

        this._email = config.email;
        this._password = config.password;
        this._token = config.token;

        // load signing key
        var s1 = CryptoJS.enc.Base64.parse(
            'VzeC4H4h+T2f0VI180nVX8x+Mb5HiTtGnKgH52Otj8ZCGDz9jRW'
            + 'yHb6QXK0JskSiOgzQfwTY5xgLLSdUSreaLVMsVVWfxfa8Rw==');
        var s2 = CryptoJS.enc.Base64.parse(
            'ZAPnhUkYwQ6y5DdQxWThbvhJHN8msQ1rqJw0ggKdufQjelrKuiG'
            + 'GJI30aswkgCWTDyHkTGK9ynlqTkJ5L4CiGGUabGeo8M6JTQ==');
        for (var idx = 0; idx < s1.words.length; idx++) {
            s1.words[idx] ^= s2.words[idx];
        }
        this._key = s1;

        var that = this;

        var promise;
        if (config.token) {
            // The token has already been provided in the config. We don't need to login first.
            promise = that._loadWebToken(config.token).then(function (webToken) {
                return that._loadSettings(webToken, config.token);
            });
        } else {
            // No token provided in the config. We need to login with the given creds and fetch it
            // first.
            promise = that._login(config.email, config.password).then(function (token) {
                that._token = token;
                return that._loadWebToken(token).then(function (webToken) {
                    return that._loadSettings(webToken, token);
                });
            });
        }
        promise.then(function () {
            return that._ensureCollection();
        }).then(function () {
            that._ready = true;
        });
    },

    _convertTrack: function (entry) {
        var realId;
        if (entry.id) {
            realId = entry.id;
        } else {
            realId = entry.storeId;
        }

        return {
            artist: entry.artist,
            album: entry.album,
            track: entry.title,
            year: entry.year,

            albumpos: entry.trackNumber,
            discnumber: entry.discNumber,

            size: entry.estimatedSize,
            duration: entry.durationMillis / 1000,

            source: "Google Music",
            url: 'gmusic://track/' + realId,
            checked: true
        };
    },

    _convertAlbum: function (entry) {
        return {
            artist: entry.artist,
            album: entry.album,
            year: entry.year
        };
    },

    _ensureCollection: function () {
        var that = this;

        return gmusicCollection.revision({
            id: gmusicCollection.settings.id
        }).then(function (result) {
            var lastCollectionUpdate = window.localStorage["gmusic_last_collection_update"];
            if (lastCollectionUpdate && lastCollectionUpdate == result) {
                Tomahawk.log("Collection database has not been changed since last time.");
                return that._fetchAndStoreCollection();
            } else {
                Tomahawk.log("Collection database has been changed. Wiping and re-fetching...");
                return gmusicCollection.wipe({
                    id: gmusicCollection.settings.id
                }).then(function () {
                    return that._fetchAndStoreCollection();
                });
            }
        });
    },

    _fetchAndStoreCollection: function () {
        var that = this;
        var time = Date.now();
        if (!that._requestPromise) {
            Tomahawk.log("Checking if collection needs to be updated");
            Tomahawk.PluginManager.registerPlugin("collection", gmusicCollection);
            var url = that._baseURL + 'trackfeed?ct=1&hl=en_US&dv=0&alt=json&include-tracks=true';
            url += "&tier=" + (that._allAccess ? 'aa' : 'fr');
            if (window.localStorage["gmusic_last_cache_update"]) {
                url += '&updated-min=' + window.localStorage["gmusic_last_cache_update"] * 1000;
            }
            that._requestPromise = that._paginatedRequest(url).then(function (results) {
                if (results && results.length > 0) {
                    Tomahawk.log("Collection needs to be updated");

                    var tracks = results.map(function (item) {
                        return that._convertTrack(item);
                    });
                    gmusicCollection.addTracks({
                        id: gmusicCollection.settings.id,
                        tracks: tracks
                    }).then(function (newRevision) {
                        Tomahawk.log("Updated cache in " + (Date.now() - time) + "ms");
                        window.localStorage["gmusic_last_cache_update"] = Date.now();
                        window.localStorage["gmusic_last_collection_update"] = newRevision;
                    });
                } else {
                    Tomahawk.log("Collection doesn't need to be updated");
                    gmusicCollection.addTracks({
                        id: gmusicCollection.settings.id,
                        tracks: []
                    });
                }
            }, function (xhr) {
                Tomahawk.log("paginatedRequest failed: " + xhr.status + " - "
                    + xhr.statusText + " - " + xhr.responseText);
                Tomahawk.PluginManager.unregisterPlugin("collection", gmusicCollection);
            }).finally(function () {
                that._requestPromise = undefined;
            });
        }
        return that._requestPromise;
    },

    _paginatedRequest: function (url, results, nextPageToken) {
        var that = this;
        var settings = {
            headers: {
                'Authorization': 'GoogleLogin auth=' + this._token
            },
            dataFormat: 'json',
            data: {}
        };
        if (nextPageToken) {
            settings.data['start-token'] = nextPageToken;
        }
        results = results || [];
        return Tomahawk.post(url, settings).then(function (response) {
            if (response.data) {
                results = results.concat(response.data.items);
                Tomahawk.log("Received chunk of tracks, tracks total: " + results.length);
            }
            if (response.nextPageToken) {
                return that._paginatedRequest(url, results, response.nextPageToken);
            } else {
                return results;
            }
        });
    },

    _execSearchAllAccess: function (query, max_results) {
        var that = this;
        var url = this._baseURL + "query";
        var settings = {
            data: {
                q: query,
                ct: '1',
                hl: 'en_US',
                dv: 0,
                tier: that._allAccess ? 'aa' : 'fr'
            },
            headers: {
                Authorization: 'GoogleLogin auth=' + this._token
            }
        };
        if (max_results) {
            settings.data["max-results"] = max_results;
        }

        var time = Date.now();
        return Tomahawk.get(url, settings).then(function (response) {
            var results = {tracks: [], albums: [], artists: []};
            // entries member is missing when there are no results
            if (!response.entries) {
                return results;
            }

            var artistMap = {}, albumMap = {};
            for (var idx = 0; idx < response.entries.length; idx++) {
                var entry = response.entries[idx];
                switch (entry.type) {
                    case '1':
                        results.tracks.push(that._convertTrack(entry.track));
                        break;
                    case '2':
                        artistMap[entry.artist] = true;
                        break;
                    case '3':
                        albumMap[entry.artist + "♣" + entry.album + "♣" + entry.year]
                            = that._convertAlbum(entry);
                        break;
                }
            }
            results.artists = Object.keys(artistMap);
            var keys = Object.keys(albumMap);
            results.albums = keys.map(function (key) {
                return albumMap[key];
            });
            Tomahawk.log("All Access: Searched with query '" + query + "' for "
                + (Date.now() - time) + "ms and found " + results.tracks.length + " track results");
            return results;
        }, function (xhr) {
            Tomahawk.log("Google Music search '" + query + "' failed:\n"
                + xhr.status + " " + xhr.statusText.trim() + "\n"
                + xhr.responseText.trim()
            );
        })
    },

    search: function (params) {
        var query = params.query;

        if (!this._ready) {
            return;
        }

        if (this._allAccess) {
            return this._execSearchAllAccess(query, 20);
        } else {
            return [];
        }
    },

    resolve: function (params) {
        var artist = params.artist;
        var album = params.album;
        var track = params.track;

        if (!this._ready) {
            return;
        }

        if (this._allAccess) {
            var time = Date.now();
            // Format the search as track-artists-album for now
            var query = artist;
            if (album) {
                query += ' - ' + album;
            }
            query += ' - ' + track;
            return this._execSearchAllAccess(query, 1).then(function (results) {
                Tomahawk.log("All Access: Resolved track '" + artist + " - " + track + " - "
                + album + "' for " + (Date.now() - time) + "ms and found "
                + results.tracks.length + " track results");
                return results.tracks;
            });
        } else {
            return [];
        }
    },

    _parseUrn: function (urn) {
        var match = urn.match(/^gmusic:\/\/([a-z]+)\/(.+)$/);
        if (!match) {
            return null;
        }

        return {
            type: match[1],
            id: match[2]
        };
    },

    _generateSalt: function (len) {
        var salt = "";
        var charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (var i = 0; i < len; i++) {
            salt += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return salt;
    },

    getStreamUrl: function (params) {
        var url = params.url;

        if (!this._ready) {
            Tomahawk.log("Failed to get stream for '" + url + "', resolver wasn't ready");
            return;
        }
        var urn = this._parseUrn(url);
        if (!urn || 'track' != urn.type) {
            Tomahawk.log("Failed to get stream. Couldn't parse '" + urn + "'");
            return;
        }
        Tomahawk.log("Getting stream for '" + url + "', track ID is '" + urn.id + "'");

        var salt = this._generateSalt(13);
        var sig = CryptoJS.HmacSHA1(urn.id + salt, this._key).toString(CryptoJS.enc.Base64)
            .replace(/=+$/, '')   // no padding
            .replace(/\+/g, '-')  // URL-safe alphabet
            .replace(/\//g, '_'); // URL-safe alphabet

        return {
            url: 'https://mclients.googleapis.com/music/mplay'
            + '?net=wifi&pt=e&hl=en_US&dv=0'
            + '&tier=' + (this._allAccess ? 'aa' : 'fr')
            + '&' + ('T' == urn.id[0] ? 'mjck' : 'songid')
            + '=' + urn.id + '&slt=' + salt + '&sig=' + sig,
            headers: {
                'Authorization': 'GoogleLogin auth=' + this._token,
                'X-Device-ID': this._deviceId
            }
        }
    },

    _loadSettings: function (webToken, token) {
        var that = this;

        var url = that._webURL + 'services/fetchsettings';
        var settings = {
            data: {
                u: 0,
                xt: webToken
            },
            dataType: 'json',
            headers: {
                'Authorization': 'GoogleLogin auth=' + token
            }
        };
        return Tomahawk.post(url, settings).then(function (response) {
            if (!response.settings) {
                Tomahawk.log("Wasn't able to get resolver settings");
                throw new Error("Wasn't able to get resolver settings");
            }

            that._allAccess = response.settings.entitlementInfo.isSubscription
                || response.settings.entitlementInfo.isTrial;
            Tomahawk.log("Google Play Music All Access is "
                + (that._allAccess ? "enabled" : "disabled" )
            );

            for (var i = 0; i < response.settings.uploadDevice.length; i++) {
                var device = response.settings.uploadDevice[i];
                if (2 == device.deviceType) {
                    // We have an Android device id
                    that._deviceId = device.id.slice(2); //remove prepended "0x"
                    Tomahawk.log(that.settings.name + " using Android device ID '"
                        + that._deviceId + "' from " + device.carrier + " "
                        + device.manufacturer + " " + device.model);
                    return;
                } else if (3 == device.deviceType) {
                    // We have an iOS device id
                    that._deviceId = device.id;
                    Tomahawk.log(that.settings.name + " using iOS device ID '"
                        + that._deviceId + "' from " + device.name);
                    return;
                }
            }

            Tomahawk.log("There aren't any Android/iOS devices associated with your Google "
                + "account. This resolver needs an Android/iOS device ID to function. Please "
                + "open the Google Music application on an Android/iOS device and log in to "
                + "your account.");
            throw new Error("No Android/iOS devices associated with Google account."
                + " Please open the 'Play Music' App, log in and play a song");
        });
    },

    _loadWebToken: function (token) {
        var that = this;

        var url = that._webURL + 'listen';
        var settings = {
            type: 'HEAD',
            needCookieHeader: true,
            rawResponse: true,
            headers: {
                'Authorization': 'GoogleLogin auth=' + token
            }
        };
        return Tomahawk.ajax(url, settings).then(function (request) {
            var match = request.getResponseHeader('Set-Cookie').match(/^xt=([^;]+)(?:;|$)/m);
            if (match) {
                return match[1];
            } else {
                Tomahawk.log("xt cookie missing");
                throw new Error("Wasn't able to get web token");
            }
        });
    },

    /** Asynchronously authenticates with the SkyJam service.
     * Only one login attempt will run at a time. If a login request is
     * already pending the callback (if one is provided) will be queued
     * to run when it is complete.
     */
    _login: function (email, password) {
        var that = this;

        var url = this._authUrl;
        var settings = {
            data: {
                "accountType": "HOSTED_OR_GOOGLE",
                "Email": email.trim(),
                "has_permission": 1,
                "add_account": 1,
                "EncryptedPasswd": that._buildSignature(email.trim(), password.trim()),
                "service": "ac2dm",
                "source": "android",
                "device_country": "us",
                "operatorCountry": "us",
                "lang": "en",
                "sdk_version": "17"
            },
            headers: {
                'User-Agent': that._userAgent
            }
        };

        if (!this._loginPromise) {
            this._loginPromise = Tomahawk.post(url, settings).then(function (response) {
                var parsedRes = that._parseAuthResponse(response);
                if (!parsedRes['Token']) {
                    throw new Error("There's no 'Token' in the response");
                }

                var settings = {
                    data: {
                        "accountType": "HOSTED_OR_GOOGLE",
                        "Email": email.trim(),
                        "has_permission": 1,
                        "EncryptedPasswd": parsedRes['Token'],
                        "service": "sj",
                        "source": "android",
                        "app": "com.google.android.music",
                        "client_sig": "38918a453d07199354f8b19af05ec6562ced5788",
                        "device_country": "us",
                        "operatorCountry": "us",
                        "lang": "en",
                        "sdk_version": "17"
                    },
                    headers: {
                        'User-Agent': that._userAgent
                    }
                };
                return Tomahawk.post(url, settings).then(function (response) {
                    var parsedRes = that._parseAuthResponse(response);
                    if (!parsedRes['Auth']) {
                        throw new Error("There's no 'Auth' in the response");
                    }
                    Tomahawk.log("Google Play Music logged in successfully");
                    return parsedRes['Auth'];
                });
            }).finally(function () {
                that._loginPromise = undefined;
            });
        }
        return this._loginPromise;
    },

    testConfig: function (config) {
        var that = this;

        var promise;
        if (config.token) {
            // The token has already been provided in the config. We don't need to login first.
            promise = that._loadWebToken(config.token).then(function (webToken) {
                return that._loadSettings(webToken, config.token);
            });
        } else {
            // No token provided in the config. We need to login with the given creds and fetch it
            // first.
            promise = that._login(config.email, config.password).then(function (token) {
                return that._loadWebToken(token).then(function (webToken) {
                    return that._loadSettings(webToken, token);
                });
            });
        }
        return promise.then(function () {
            return Tomahawk.ConfigTestResultType.Success;
        }, function (error) {
            if (error instanceof Error) {
                return error.message;
            } else if (error && error.status == 403) {
                return Tomahawk.ConfigTestResultType.InvalidCredentials;
            } else {
                return Tomahawk.ConfigTestResultType.CommunicationError;
            }
        });
    },

    _parseAuthResponse: function (res) {
        parsedRes = {};
        var lines = res.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i]) {
                continue;
            }
            var parts = lines[i].split("=");
            parsedRes[parts[0]] = parts[1];
        }
        return parsedRes;
    },

    /**
     * Author: jonleighton - https://gist.github.com/jonleighton/958841
     */
    _arrayBufferToBase64: function (arrayBuffer) {
        var base64 = '';
        var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

        var bytes = new Uint8Array(arrayBuffer);
        var byteLength = bytes.byteLength;
        var byteRemainder = byteLength % 3;
        var mainLength = byteLength - byteRemainder;

        var a, b, c, d;
        var chunk;

        // Main loop deals with bytes in chunks of 3
        for (var i = 0; i < mainLength; i = i + 3) {
            // Combine the three bytes into a single integer
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

            // Use bitmasks to extract 6-bit segments from the triplet
            a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
            b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
            c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
            d = chunk & 63;              // 63       = 2^6 - 1

            // Convert the raw binary segments to the appropriate ASCII encoding
            base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
        }

        // Deal with the remaining bytes and padding
        if (byteRemainder == 1) {
            chunk = bytes[mainLength];

            a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

            // Set the 4 least significant bits to zero
            b = (chunk & 3) << 4;// 3   = 2^2 - 1

            base64 += encodings[a] + encodings[b] + '=='
        } else if (byteRemainder == 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

            a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
            b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

            // Set the 2 least significant bits to zero
            c = (chunk & 15) << 2;// 15    = 2^4 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + '='
        }

        return base64
    },

    _buildSignature: function (email, password) {
        var buffer = new ArrayBuffer(133);
        var signature = new Uint8Array(buffer);

        var keyBytes = asmCrypto.base64_to_bytes(this._googlePlayKey);

        var hashBytes = asmCrypto.SHA1.bytes(keyBytes);
        // 0 is always the first element
        signature[0] = 0;
        // the elements' next 4 bytes are set to the first 4 bytes of the sha-1 hash
        signature.set(hashBytes.subarray(0, 4), 1);

        // Now parse the modulus
        var modLength = this._bytesToInt(keyBytes, 0);
        var modulus = keyBytes.subarray(4, 4 + modLength);

        // Now parse the exponent
        var expLength = this._bytesToInt(keyBytes, 4 + modLength);
        var exponent = keyBytes.subarray(8 + modLength, 8 + modLength + expLength);

        // Ready to encrypt!
        var pubkey = [modulus, exponent];
        var clearBytes = asmCrypto.string_to_bytes(email + '\0' + password);
        var encryptedBytes = asmCrypto.RSA_OAEP_SHA1.encrypt(clearBytes, pubkey);
        signature.set(encryptedBytes, 5);

        // Final url-safe encode in base64 and we're done
        return this._arrayBufferToBase64(buffer);
    },

    _bytesToInt: function (byteArray, start) {
        return (0xFF & byteArray[start]) << 24 | (0xFF & byteArray[(start + 1)]) << 16
            | (0xFF & byteArray[(start + 2)]) << 8 | 0xFF & byteArray[(start + 3)]
    }
});

Tomahawk.resolver.instance = GMusicResolver;

var gmusicCollection = Tomahawk.extend(Tomahawk.Collection, {
    resolver: GMusicResolver,
    settings: {
        id: "gmusic",
        prettyname: "Google Music",
        description: GMusicResolver._email,
        iconfile: "contents/images/icon.png",
        trackcount: GMusicResolver.trackCount
    }
});
