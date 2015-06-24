var ExampleResolver = Tomahawk.extend(Tomahawk.Resolver, {

    apiVersion: 0.9, // Tell Tomahawk that this is a promise-based Resolver implementation

    /**
     * Static Resolver settings
     */
    settings: {
        name: 'Example Resolver', // The pretty name of this Resolver

        weight: 75,               // The weight describes how good results of this Resolver are in
                                  // comparison to other Resolvers (0-100). A subscription Resolver
                                  // like Spotify might set this to 95, while Soundcloud only has a
                                  // weight of 85.

        timeout: 5                // The timeout-value (in seconds) determines how long Tomahawk
                                  // waits for a result from this Resolver after having called
                                  // resolve or search.
    },

    /**
     * Defines this Resolver's config dialog UI.
     */
    configUi: [
        {
            id: "example_textview",
            type: "textview",
            text: "Some very important text..."
        },
        {
            id: "example_textfield",
            type: "textfield",
            label: "Username",
            defaultValue: "admin"
        },
        {
            id: "example_textfield_password",
            type: "textfield_password",
            label: "Password",
            defaultValue: "superSafeAdminPassword!!!!0000"
        },
        {
            id: "example_checkbox",
            type: "checkbox",
            label: "Maybe the best checkbox",
            defaultValue: true
        },
        {
            id: "example_dropdown",
            type: "dropdown",
            label: "Doge dropdown",
            items: ["Such dropdown", "Many amaze", "Wow"],
            defaultValue: 1
        }
    ],

    /**
     * LEGACY! This is the old way of defining the Resolver's config dialog UI. In the future there
     * will only be the "ui"-property that provides a proper cross-compatible way of defining a UI.
     * Currently both the "ui"-property and this "getConfigUi"-function should be implemented.
     *
     *
     * @returns * Map containing information to define this Resolver's config dialog UI.
     *          Example:
     *          { widget: Tomahawk.readBase64("config.ui"),     //the file "config.ui" defines a Qt UI
     *            fields: [
     *                {
     *                    name: "example_textfield",             //name/id of this UI property
     *                    widget: "example_textfield",           //the corresponding UI-widget in config.ui
     *                    property: "text"                      //the type of this UI property
     *                                                          //can be [text, checked, currentIndex]
     *                }, {
     *                    name: "example_textfield_password",
     *                    widget: "example_textfield_password",
     *                    property: "text"
     *                }, {
     *                    name: "example_checkbox",
     *                    widget: "example_checkbox",
     *                    property: "checked"
     *                }, {
     *                    name: "example_dropdown",
     *                    widget: "example_dropdown",
     *                    property: "currentIndex"
     *                }
     *            ] }
     */
    getConfigUi: function () {
        Tomahawk.log("getConfigUi called");
        return {
            widget: Tomahawk.readBase64("config.ui"),
            fields: [{
                name: "example_textfield",
                widget: "example_textfield",
                property: "text"
            }, {
                name: "example_textfield_password",
                widget: "example_textfield_password",
                property: "text"
            }, {
                name: "example_checkbox",
                widget: "example_checkbox",
                property: "checked"
            }, {
                name: "example_dropdown",
                widget: "example_dropdown",
                property: "currentIndex"
            }]
        };
    },

    /**
     * Always called when this resolver is being loaded in Tomahawk.
     */
    init: function () {
        Tomahawk.log("init called");
        // initialize some stuff
        Tomahawk.PluginManager.registerPlugin("collection", exampleCollection);
        exampleCollection.addTracks({
            id: exampleCollection.settings.id,
            tracks: [
                {
                    artist: "Queen",                            //the artist's name
                    artistDisambiguation: "",                   //allows multiple artists with the same name
                    albumArtist: "DJ Queenlover",               //title of the album
                    albumArtistDisambiguation: "",              //allows multiple albumArtists with the same name
                    album: "Compilation of Queen Remixes",      //title of the album
                    track: "We will rock you(remix)",           //title of the track
                    url: "http://x.y/wewillrockyourmx.mp3",     //URL to stream the track from
                    duration: "180",                            //duration in seconds
                    linkUrl: "http://x.y/wewillrockyourmx.html" //corresponding website link
                }, {
                    artist: "Queen",
                    artistDisambiguation: "",
                    albumArtist: "DJ Queenlover",
                    albumArtistDisambiguation: "",
                    album: "Compilation of Queen Remixes",
                    track: "Bohemian Rhapsody(remix)",
                    url: "http://x.y/bohemianrhapsodyrmx.mp3",
                    duration: "240",
                    linkUrl: "http://x.y/bohemianrhapsodyrmx.html"
                }, {
                    artist: "DJ Queenlover",
                    artistDisambiguation: "",
                    albumArtist: "DJ Queenlover",
                    albumArtistDisambiguation: "",
                    album: "Compilation of Queen Remixes",
                    track: "My own great song",
                    url: "http://x.y/myowngreatsong.mp3",
                    duration: "360",
                    linkUrl: "http://x.y/myowngreatsong.html"
                }, {
                    artist: "Queen",
                    artistDisambiguation: "",
                    albumArtist: "Queen",
                    albumArtistDisambiguation: "",
                    album: "A Kind of Magic",
                    track: "Who Wants to Live Forever",
                    url: "http://x.y/whowantstoliveforever.mp3",
                    duration: "180",
                    linkUrl: "http://x.y/whowantstoliveforever.html"
                }, {
                    artist: "The Rolling Stones",
                    artistDisambiguation: "",
                    albumArtist: "The Rolling Stones",
                    albumArtistDisambiguation: "",
                    album: "Dirty Work",
                    track: "One Hit (To the Body)",
                    url: "http://x.y/onehittothebody.mp3",
                    duration: "240",
                    linkUrl: "http://x.y/onehittothebody.html"
                }, {
                    artist: "The Rolling Stones",
                    artistDisambiguation: "",
                    albumArtist: "The Rolling Stones",
                    albumArtistDisambiguation: "",
                    album: "Steel Wheels",
                    track: "Sad Sad Sad",
                    url: "http://x.y/sadsadsad.mp3",
                    duration: "360",
                    linkUrl: "http://x.y/sadsadsad.html"
                }
            ]
        });
    },

    /**
     * Whenever a new config has been saved this function is being called.
     * This happens normally when the user clicks "OK" in the Resolver config dialog.
     *
     *
     * @param newConfig A map containing the newly saved config values. The structure depends on
     *                  this Resolver's UI definition. The ids of the different UI elements are
     *                  being used to reference the values.
     */
    newConfigSaved: function (newConfig) {
        Tomahawk.log("newConfigSaved called - params: " + JSON.stringify(newConfig));
        var username = newConfig.example_textfield;
        var password = newConfig.example_textfield_password;
        var checkboxChecked = newConfig.example_checkbox;
        var dropdownItemSelected = newConfig.example_dropdown;

        Tomahawk.log("newConfigSaved - username: " + username);
        Tomahawk.log("newConfigSaved - password: " + password);
        Tomahawk.log("newConfigSaved - checkboxChecked: " + checkboxChecked);
        Tomahawk.log("newConfigSaved - dropdownItemSelected: " + dropdownItemSelected);
    },

    /**
     * Check whether or not the service accepts the given config. For Resolvers that require logging
     * into a service this normally means that the credentials are being send to the server in order
     * to test if they're valid. For media-server Resolvers like Ampache this function should test
     * whether or not the given server-URL is reachable. Other Resolvers might simply want to verify
     * if the given config is valid (e.g. check that values aren't out of range or don't contain
     * invalid characters)
     *
     *
     * @param config Map containing the current config values to test. The structure depends on this
     *               Resolver's UI definition. The ids of the different UI elements are being used
     *               to reference the values.
     *
     *
     * @returns Type (See Tomahawk.ConfigTestResultType) containing the result of the test or a
     *          custom error message.
     *          Before you use a custom error message though, please have a look at the other types
     *          and use the standard types whenever you can. Standard error messages are translated
     *          into many different languages and provide a consistent wording when notifying the
     *          user.
     */
    testConfig: function (config) {
        Tomahawk.log("testConfig called - params: " + JSON.stringify(config));
        var username = config.example_textfield;

        var data = {
            data: {
                q: encodeURIComponent(username)
            }
        };
        return Tomahawk.get("http://www.google.de", data).then(function (result) {
            Tomahawk.log("testConfig - returned Tomahawk.ConfigTestResultType.Success");
            return Tomahawk.ConfigTestResultType.Success;
        }, function (xhr) {
            if (xhr.status == 401) {
                Tomahawk.log("testConfig - returned Tomahawk.ConfigTestResultType.InvalidCredentials");
                return Tomahawk.ConfigTestResultType.InvalidCredentials;
            } else {
                Tomahawk.log("testConfig - returned custom error message");
                return "Some special error has happened that is not covered by any type in "
                    + "Tomahawk.ConfigTestResultType! Here's what happened and how you can resolve"
                    + "this issue :)";
            }
        });
    },

    /**
     * Resolve the track described by the given params-map.
     * Searches for the best results and parses them into the standard result format.
     *
     *
     * @param params A map containing all of the necessary parameters describing the track to find a
     *               playable result for.
     *
     *               Example:
     *               { artist: "Queen",                         //the artist's name
     *                 album: "Greatest Hits",                  //title of the album
     *                 track: "We will rock you" }              //title of the track
     *
     *
     * @returns An array of results containing all information so that Tomahawk is able to display
     *          and play the tracks.
     *
     *          An example of a single standardized result in the results-array:
     *          { artist: "Queen",                              //the artist's name
     *            album: "The Greatest Hits",                   //title of the album
     *            track: "We will rock you",                    //title of the track
     *            url: "http://x.y/wewillrockyou.mp3",          //URL to stream the track from
     *            duration: "180",                              //duration in seconds
     *            linkUrl: "http://x.y/wewillrockyou.html" }    //corresponding website link
     */
    resolve: function (params) {
        Tomahawk.log("resolve called - params: " + JSON.stringify(params));
        var artist = params.artist;
        var album = params.album;
        var track = params.track;

        var data = {
            data: {
                q: encodeURIComponent(artist + " " + track)
            }
        };
        return Tomahawk.get("http://www.google.de", data).then(function (results) {
            return [{
                artist: "Queen",                                //the artist's name
                album: "The Greatest Hits",                     //title of the album
                track: "We will rock you",                      //title of the track
                url: "http://x.y/wewillrockyou.mp3",            //URL to stream the track from
                duration: "180",                                //duration in seconds
                linkUrl: "http://x.y/wewillrockyou.html"        //corresponding website link
            }];
        }, function (xhr) {
            Tomahawk.log("resolve - Error(\"Sry, couldn't get results\")");
            throw new Error("Sry, couldn't get results");
        });
    },

    /**
     * Searches for tracks with the given query-string and parses the results into the standard
     * result format.
     *
     *
     * @param params Map containing the query-string with which to search for tracks.
     *
     *               Example:
     *               { query: "Queen we will rock you" }        //query-string to search with
     *
     *
     * @returns An array of results containing all information so that Tomahawk is able to display
     *          and play the tracks.
     *
     *          An example of a single standardized result in the results-array:
     *          { artist: "Queen",                              //the artist's name
     *            album: "The Greatest Hits",                   //title of the album
     *            track: "We will rock you",                    //title of the track
     *            url: "http://x.y/wewillrockyou.mp3",          //URL to stream the track from
     *            duration: "180",                              //duration in seconds
     *            linkUrl: "http://x.y/wewillrockyou.html" }    //corresponding website link
     */
    search: function (params) {
        Tomahawk.log("search called - params: " + JSON.stringify(params));
        var query = params.query;

        var data = {
            data: {
                q: encodeURIComponent(query)
            }
        };
        return Tomahawk.get("http://www.google.de", data).then(function (results) {
            return [{
                artist: "Queen",                                //the artist's name
                album: "The Greatest Hits",                     //title of the album
                track: "We will rock you",                      //title of the track
                url: "http://x.y/wewillrockyou.mp3",            //URL to stream the track from
                duration: "180",                                //duration in seconds
                linkUrl: "http://x.y/wewillrockyou.html"        //corresponding website link
            }];
        }, function (xhr) {
            Tomahawk.log("resolve - Error(\"Sry, couldn't get results\")");
            throw new Error("Sry, couldn't get results");
        });
    },

    /***********************************************************************************************
     *                                                                                             *
     *                              Optional URL-translation function                              *
     *                                                                                             *
     **********************************************************************************************/

    /**
     * Translate the given URL-string into a playable URL-String.
     * Some services (especially those that require a subscription) don't directly provide a link to
     * let's say an mp3-file. Instead they'll give out some sort of id that identifies a particular
     * track on their service. If we now want to play this track, we have to ask the service to
     * hand out some sort of link that we can stream the audio data from. That's what this function
     * does.
     *
     *
     * @param params Map containing the URL-String that identifies the track we want to play back
     *
     *        Example:
     *        { url: "exampleresolver://752078502200" }    //URL-String that identifies the track
     *
     *
     * @returns String which contains the translated and playable URL.
     *
     */
    getStreamUrl: function (params) {
        Tomahawk.log("getStreamUrl called - params: " + JSON.stringify(params));
        var url = params.url;

        var data = {
            data: {
                q: encodeURIComponent(url)
            }
        };
        return Tomahawk.get("http://www.google.de", data).then(function (result) {
            Tomahawk.log("getStreamUrl - returned \"http://x.y/wewillrockyou.mp3\"");
            return {
                url: "http://x.y/wewillrockyou.mp3"       //URL from which we can stream the track
            };
        });
    },

    /***********************************************************************************************
     *                                                                                             *
     *                               Optional URL-parsing functions                                *
     *                                                                                             *
     **********************************************************************************************/

    /**
     * Determines whether or not this Resolver can parse the given URL-string.
     *
     *
     * @param params Map containing the URL-String and a type that defines into what kind of
     *               result the URL-string should be parsable.
     *
     *               Example:
     *               { url: "https://hatchet.is/music/Queen/_/We%20Will%20Rock%20You", //the URL-String
     *                 type: Tomahawk.UrlType.Track }                                  //the type (see Tomahawk.UrlType)
     *
     *
     * @returns Boolean indicating if the given URL-String is parsable.
     */
    canParseUrl: function (params) {
        Tomahawk.log("canParseUrl called - params: " + JSON.stringify(params));
        var url = params.url;
        var type = params.type;

        if (!url) {
            Tomahawk.log("canParseUrl - Error(\"The given URL-String is null or empty!\"");
            throw new Error("The given URL-String is null or empty!");
        }
        var result;
        switch (type) {
            case TomahawkUrlType.Album:
                result = /^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n]+\/[^\/\n]+$/.test(url);
                break;
            case TomahawkUrlType.Artist:
                result = /^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n][^\/\n_]+$/.test(url);
                break;
            case TomahawkUrlType.Track:
                result = /^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n]+\/_\/[^\/\n]+$/.test(url);
                break;
            case TomahawkUrlType.Playlist:
                result
                    = /^https?:\/\/(www\.)?hatchet\.is\/people\/[^\/\n]+\/playlists\/[^\/\n]+$/.test(url);
                break;
            default:
                Tomahawk.log("canParseUrl - Error(\"Invalid type!\"");
                throw new Error("Invalid type!");
        }
        Tomahawk.log("canParseUrl - returned " + result);
    },

    /**
     * Looks up the given URL-String on some service and fetches the track's metadata. Then that
     * metadata is being parsed into the standardized format so that Tomahawk can use the
     * information to display the track and search for sources through every available Resolver.
     *
     *
     * @param params Map containing the URL-String
     *
     *               Examples:
     *               { url: "https://hatchet.is/music/Queen/_/We%20Will%20Rock%20You" } //the URL-String
     *               { url: "https://hatchet.is/people/mrmaffen/playlists/509e81298651fd9ee3e81a7b_53f136f32484f2119f0077d4" }    //the URL-String
     *
     *
     * @returns * Map containing a type (see Tomahawk.UrlType) and the parsed metadata.
     *
     *          Example 1 (track result):
     *          { type: Tomahawk.UrlType.Track,                              // the result's type
     *            track: "We will rock you",                                 // the track's title
     *            artist: "Queen",                                           // the artist's name
     *            album: "Greatest Hits" }                                   // the album's title
     *
     *          Example 2 (playlist result):
     *          { type: Tomahawk.UrlType.Playlist,                           // the result's type
     *            title: "Boys Noize",                                       // the playlist's title
     *            guid: "509e81298651fd9ee3e81a7b_53f136f32484f2119f0077d4", // a unique id that identifies this playlist
     *            info: "A playlist on Hatchet.",                            // a description of this playlist
     *            creator: "mrmaffen",                                       // the creator of this playlist
     *            linkUrl: "https://hatchet.is/people/mrmaffen/playlists",   // the URL to a website showing this playlist
     *            tracks: [...] }                                            // array of this playlist's tracks (see Example 1)
     *
     *          Example 3 (xspf-playlist result):
     *          { type: Tomahawk.UrlType.XspfPlaylist,                       // the result's type
     *            url: "http://x.y/bestofqueen.xspf" }                       // the link to the .xspf-file
     */
    lookupUrl: function (params) {
        Tomahawk.log("lookupUrl called - params: " + JSON.stringify(params));
        var url = params.url;

        var urlParts =
            url.split('/').filter(function (item) {
                return item.length != 0;
            }).map(function (s) {
                return decodeURIComponent(s.replace(/\+/g, '%20'));
            });
        var result;
        if (/^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n]+\/[^\/\n]+$/.test(url)) {
            // We have to deal with an Album
            result = {
                type: 'album',
                artist: urlParts[urlParts.length - 2],
                name: urlParts[urlParts.length - 1]
            };
            Tomahawk.log("lookupUrl - returned " + JSON.stringify(result));
            return result;
        } else if (/^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n][^\/\n_]+$/.test(url)) {
            // We have to deal with an Artist
            result = {
                type: 'artist',
                name: urlParts[urlParts.length - 1]
            };
            Tomahawk.log("lookupUrl - returned " + JSON.stringify(result));
            return result;
        } else if (/^https?:\/\/(www\.)?hatchet\.is\/music\/[^\/\n]+\/_\/[^\/\n]+$/.test(url)) {
            Tomahawk.log("Found a track");
            // We have to deal with a Track
            result = {
                type: "track",
                artist: urlParts[urlParts.length - 3],
                title: urlParts[urlParts.length - 1]
            };
            Tomahawk.log("lookupUrl - returned " + JSON.stringify(result));
            return result;
        } else if (/^https?:\/\/(www\.)?hatchet\.is\/people\/[^\/\n]+\/playlists\/[^\/\n]+$/.test(url)) {
            // We have to deal with a Playlist
            var match = url.match(/^https?:\/\/(?:www\.)?hatchet\.is\/people\/[^\/\n]+\/playlists\/([^\/\n]+)$/);
            var query = 'https://api.hatchet.is/v1/playlists/' + match[1];
            Tomahawk.log("lookupUrl - found a playlist, calling url: '" + query + "'");
            return Tomahawk.get(query).then(function (xhr) {
                var res = JSON.parse(xhr.responseText);
                var result = {
                    type: "playlist",
                    title: res.playlists[0].title,
                    guid: res.playlists[0].id,
                    info: "A playlist on Hatchet.",
                    creator: res.playlists[0].user,
                    url: url,
                    tracks: []
                };
                var playlistEntries = {};
                res.playlistEntries.forEach(function (item) {
                    playlistEntries[item.id] = item;
                });
                var artists = {};
                res.artists.forEach(function (item) {
                    artists[item.id] = item;
                });
                var tracks = {};
                res.tracks.forEach(function (item) {
                    tracks[item.id] = item;
                });
                result.tracks = res.playlists[0].playlistEntries.map(function (item) {
                    var track = tracks[playlistEntries[item].track];
                    return {
                        type: "track",
                        title: track.name,
                        artist: artists[track.artist].name
                    };
                });
                Tomahawk.log("lookupUrl - returned " + JSON.stringify(result));
                return result;
            });
        }
    }
});

Tomahawk.resolver.instance = ExampleResolver;

var exampleCollection = Tomahawk.extend(Tomahawk.Collection, {
    settings: {
        id: "example",
        prettyname: "Example",
        description: "An Example Collection",
        iconfile: "contents/images/icon.png",
        trackcount: 6
    }
});
