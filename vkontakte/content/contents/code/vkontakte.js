/* vk.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * API documentation: https://vk.com/dev
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

var VkontakteResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    //These are copied from kodi vk.com plugin
    APP_ID : '2054573',
    APP_KEY : 'KUPNPTTQGApLFVOVgqdx',
    APP_SCOPE : 'audio',
    API_VERSION : '5.0',

    STORAGE_KEY : 'vk.com.access_token',

    logged_in: null, // null, = not yet tried, 0 = pending, 1 = success, 2 = failed

    settings: {
        cacheTime: 300,
        name: 'VK.com',
        icon: '../images/icon.png',
        weight: 75,
        timeout: 8
    },

    getConfigUi: function() {
        return {
            "widget": Tomahawk.readBase64( "config.ui" ),
            fields: [{
                name: "email",
                widget: "email_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }]
        };
    },

    newConfigSaved: function() {
        var config = this.getUserConfig();

        var changed = 
            this._email !== config.email ||
            this._password !== config.password;

        if (changed) {
            this.init();
        }
    },

    testConfig: function (config) {
        return this._getLoginPromise(config).catch(function (error) {
            throw new Error('Invalid credentials');
        });
    },

    init: function() {
        var config = this.getUserConfig();

        this._email = config.email;
        this._password = config.password;

        if (!this._email || !this._password) {
            Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);
            //This is being called even for disabled ones
            //throw new Error( "Invalid configuration." );
            Tomahawk.log("Invalid Configuration");
            return;
        }

        return this._login(config);
    },

    _apiCall: function (api, params) {
        if (!this.logged_in) {
            return this._defer(this._apiCall, [api, params], this);
        } else if (this.logged_in === 2) {
            throw new Error('Failed login, cannot _apiCall.');
        }

        params['access_token'] = this._access_token;
        params['v']            = this.API_VERSION;

        return Tomahawk.get("https://api.vk.com/method/" + api, {
            data: params
        }).then(
            function (resp) {
                if(resp.error)
                {
                    Tomahawk.log(JSON.stringify(resp));
                    //14 is Captcha needed, TODO: Once Tomahawk will support
                    //   showing this we need to show it to user
                    //if (resp.error.error_code == 14)
                    //Captcha error response will contain the following:
                    //  captcha_sid  - id for captcha
                    //  captcha_img  - url for captcha image
                    //
                    //To validate it you need to add
                    //  captcha_sid - id of the captcha you presented to user
                    //  captcha_key - text of captcha image
                    //to subsequent requests
                    if(resp.error.error_msg)
                        throw new Error("VK.com api call error: " + resp.error.error_msg);
                    else
                        throw new Error("VK.com api call error: " + JSON.stringify(resp));
                }
                return resp;
            },
            function (error) {
                throw new Error("VK.com api call error: " + JSON.stringify(error));
            }
        );
    },

    _convertTrack: function (entry) {
        var escapeRegExp = function (string){
            return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        };
    
        entry = {
            artist:     entry.artist,
            track:      entry.title,
            title:      entry.title,
            duration:   entry.duration,
            url:        entry.url,
            type:       "track",
        };
        var trackInfo = this;
        if (trackInfo.title) {
            if (entry.artist.toLowerCase().search(trackInfo.artist.toLowerCase()) != -1 &&
                    entry.artist.toLowerCase().search(trackInfo.album.toLowerCase()) != -1)
                //Assuming user put "Vader - The Ultimate Incantation" into
                //artist
            {
                entry.artist = trackInfo.artist;
                entry.album  = trackInfo.album;
            }
            var regex = new RegExp('[0-9\ \-\.]+' + escapeRegExp(trackInfo.title), 'i');
            //Track title looks like:
            //  11. Decapitated Saints
            if (entry.title.match(regex)) {
                entry.title = trackInfo.title;
            }
        }

        entry.track = entry.title;

        return entry;
    },

    search: function (query, limit, trackInfo) {
        Tomahawk.log(query);
        if (!this.logged_in) {
            return this._defer(this.search, [query], this);
        } else if (this.logged_in ===2) {
            throw new Error('Failed login, cannot search.');
        }

        var that = this;

        var params = {
            count: limit || 300,
            q: query,
        };

        return this._apiCall('audio.search',params).then( function (response) {
            return response.response.items.map(that._convertTrack, trackInfo);
        });
    },

    resolve: function (artist, album, title) {
        var that = this;
        var query = [ artist, album, title ].join(' ');

        return that.search(query, 5,
                {
                    artist: artist,
                    album: album,
                    title: title
                }).then(function (results) {
                    if (results.length < 5) {
                        //Retry without album as VK.com doesn't really have an album field
                        //(at least in the sense we need it)
                        query = [ artist, title ].join(' ');
                        return that.search(query, 5,
                            {
                                artist: artist,
                                album: album,
                                title: title
                            }).then( function (new_results) {
                                return results.concat(new_results);
                            });
                    }
                    return results;
                })
    },

    _defer: function (callback, args, scope) {
        if (typeof this._loginPromise !== 'undefined' && 'then' in this._loginPromise) {
            args = args || [];
            scope = scope || this;
            Tomahawk.log('Deferring action with ' + args.length + ' arguments.');
            return this._loginPromise.then(function () {
                Tomahawk.log('Performing deferred action with ' + args.length + ' arguments.');
                callback.call(scope, args);
            });
        }
    },

    _getLoginPromise: function (config) {
        var params = {
            grant_type      : 'password',
            client_id       : this.APP_ID,
            client_secret   : this.APP_KEY,
            username        : config.email.trim(),
            password        : config.password.trim(),
            scope           : this.APP_SCOPE,
        };
        return Tomahawk.get('https://oauth.vk.com/token', {
                data: params
            }
        );
    },

    _login: function (config) {
        // If a login is already in progress don't start another!
        if (this.logged_in === 0) return;
        this.logged_in = 0;

        var that = this;
        if (Tomahawk.localStorage) {
            this._access_token = Tomahawk.localStorage.getItem(this.STORAGE_KEY);
            if (this._access_token) {
                this._logged_in = 1;
                return;
            }
        }

        this._loginPromise = this._getLoginPromise(config).then(
            function (resp) {
                Tomahawk.log(that.settings.name + " successfully logged in.");

                that._access_token = resp.access_token;
                that.logged_in = 1;
                if (Tomahawk.localStorage)
                    Tomahawk.localStorage.setItem(that.STORAGE_KEY, resp.access_token);
            },
            function (error) {
                Tomahawk.log(that.settings.name + " failed login.");

                delete that._access_token;
                delete that._user_id;
                if (Tomahawk.localStorage)
                    Tomahawk.localStorage.removeItem(that.STORAGE_KEY);

                that.logged_in = 2;
            }
        );
        return this._loginPromise;
    }
});

Tomahawk.resolver.instance = VkontakteResolver;
