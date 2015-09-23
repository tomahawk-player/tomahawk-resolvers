/* http://music.163.com resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

var api_to_extend = Tomahawk.Resolver.Promise; //Old 0.9
if(typeof api_to_extend === 'undefined')
    api_to_extend = Tomahawk.Resolver; //New 0.9

var RhapsodyResolver = Tomahawk.extend( api_to_extend, {
    apiVersion: 0.9,

    logged_in: null, // null, = not yet tried, 0 = pending, 1 = success, 2 = failed
    numQuality: ["64", "192", "320"],

    settings: {
        cacheTime: 300,
        name: 'Rhapsody',
        weight: 90,
        icon: '../images/logo.png',
        timeout: 15
    },

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
            }, {
                name: "quality",
                widget: "quality",
                property: "currentIndex"
            }]
        };
    },

    newConfigSaved: function (newConfig) {
        var changed =
            this._email !== newConfig.email ||
            this._password !== newConfig.password ||
            this._quality != newConfig.quality;

        if (changed) {
            this.init();
        }
    },

    testConfig: function (config) {
        return this._getLoginPromise(config).then(function () {
            return Tomahawk.ConfigTestResultType.Success;
        }, function (xhr) {
            if (xhr.status == 401) {
                return Tomahawk.ConfigTestResultType.InvalidCredentials;
            } else {
                return Tomahawk.ConfigTestResultType.CommunicationError;
            }
        });
    },

    _convertTrack: function (entry) {
        return {
            artist:     entry.artist.name,
            album:      entry.album.name,
            track:      entry.name,
            title:      entry.name,
            bitrate:    this.numQuality[this._quality],
            duration:   entry.duration,
            url:        'rhap://track/' + entry.id,
            checked:    true,
            type:       "track"
        };
    },

    init: function() {
        //Needed for old 0.9
        Tomahawk.addCustomUrlHandler( 'rhap', 'getStreamUrl', true );

        var config = this.getUserConfig();

        this._email = config.email;
        this._password = config.password;
        this._quality = config.quality;

        if (!this._email || !this._password) {
            Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);
            //This is being called even for disabled ones
            //throw new Error( "Invalid configuration." );
            Tomahawk.log("Invalid Configuration");
            return;
        }

        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);

        this._login(config);
    },

    _getSession: function() {
        var that = this;
        if (this._session) {
            return Promise.resolve(this._session);
        } else {
            return Tomahawk.post('https://direct.rhapsody.com/playbackserver/v1/users/' +
                    that._rhap_config.userId + '/sessions', {data : {clientType:'rhap-web'},
                        headers: that._headers, dataFormat: 'json'}).then(function(resp) {
                            that._session = resp;
                            return resp;
                    });
        }
    },

    getStreamUrl: function(qid, url) {
        var newAPI = false;
        Tomahawk.log(qid);
        Tomahawk.log(url);
        if(qid.url) {
            //new 0.9
            url = qid.url;
            newAPI = true;
        }
        var that = this;
        var id = url.match(/^rhap:\/\/([a-z]+)\/(.+)$/);
        if(!id ) {
            if(newAPI) {
                return {url:url};
            } else {
                Tomahawk.reportStreamUrl(qid, url);
            }
        }
        id = id[2];

        return this._getSession().then(function(session) {

            return Tomahawk.get('https://direct.rhapsody.com/playbackserver/v1/users/' +
                that._rhap_config.userId + '/sessions/' +
                session.id + '/track/' + id + '?context=ON_DEMAND', {
                    headers: Tomahawk.extend(that._headers, {'x-rhapsody-access-token-v2':that._rhap_config.rhapsodyAccessToken})
                }).then(function(track) {
                    url = track.stationTrack.medias.filter(function(m){
                        return m.bitrate == that.numQuality[that._quality];
                    })[0].location;
                    url = url.split('/');
                    url[5] = 'mp4:' + url[5];
                    url = url.join('/');
                    Tomahawk.log(url);
                    if(newAPI) {
                        return {url:url};
                    } else {
                        Tomahawk.reportStreamUrl(qid, url);
                    }
                });
        });
    },

    _apiCall: function(endpoint, params) {
        return Tomahawk.post(this.API_BASE + endpoint, {data: params, headers: {
            'Referer' : this.API_BASE
        }});
    },

    search: function (query) {
        if (!this.logged_in) {
            return this._defer(this.search, [query], this);
        } else if (this.logged_in === 2) {
            throw new Error('Failed login, cannot search.');
        }

        var that = this;

        if(query.hasOwnProperty('query'))
            query = query.query; //New 0.9

        return Tomahawk.get('http://api.rhapsody.com/v1/search/typeahead', {
                data : {
                   type: 'track',
                   limit: '10',
                   offset: '0',
                   apikey: that._api_key,
                   catalog: that._rhap_config.country,
                   q: query
                }
                }).then(function(results) {
                    return results.map(that._convertTrack, that);
                });
    },

    resolve: function (artist, album, track) {
        if(artist.hasOwnProperty('artist'))
        {
            //New 0.9
            album = artist.album;
            track = artist.track;
            artist = artist.artist;
        }
        var query = [ artist, track ].join(' ');
        return this.search({query:query});
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
        var that = this;
        return Tomahawk.get('http://app.rhapsody.com/assets/webclient-cli.js').then(function(data){
            var headers_to_search = [
                'x-rds-devkey',
                'x-rds-cobrand',
                'Authorization'
            ];
            var saved_headers = {};
            headers_to_search.forEach(function(header) {
                var re = RegExp('"?' + header + '"?:"([^"]+)');
                saved_headers[header] = data.match(re)[1];
            });
            saved_headers['Accept'] = 'application/json';
            saved_headers['Origin'] = 'http://app.rhapsody.com';
            //I know this function is not supposed to change state as it is
            //also used from testConfig ... but these 2 lines are safe, trust me
            that._headers = saved_headers;
            that._api_key = data.match(/apikey="([^"]+)/)[1];

            return Tomahawk.get('https://direct.rhapsody.com/authserver/v3/useraccounts?userName=' + encodeURIComponent(config.email),{
                    headers : Tomahawk.extend(saved_headers, {'x-rds-authentication' : config.password, })
                });
        });
    },

    _login: function (config) {
        // If a login is already in progress don't start another!
        if (this.logged_in === 0) {
            return;
        }
        this.logged_in = 0;

        var that = this;

        this._loginPromise = this._getLoginPromise(config)
            .then(function (resp) {
                Tomahawk.log(that.settings.name + " successfully logged in.");

                that._rhap_config = resp;

                that.logged_in = 1;
            }, function (error) {
                Tomahawk.log(that.settings.name + " failed login.");

                delete that._rhap_config;

                that.logged_in = 2;
            }
        );
        return this._loginPromise;
    }
});

Tomahawk.resolver.instance = RhapsodyResolver;


