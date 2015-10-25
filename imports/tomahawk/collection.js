export const BrowseCapability = {
    Artists: 1,
    Albums: 2,
    Tracks: 4
};

class Transaction {
    constructor(collection, id) {
        this.collection = collection;
        this.id = id;
    }


    ensureDb() {
        return new RSVP.Promise((resolve, reject) => {
            if (!this.collection.cachedDbs[this.id]) {
                Tomahawk.log("Opening database");
                var estimatedSize = 5 * 1024 * 1024; // 5MB
                this.collection.cachedDbs[id] =
                    openDatabase(this.id + "_collection", "", "Collection", estimatedSize);

                this.collection.cachedDbs[this.id].transaction(function (tx) {
                    Tomahawk.log("Creating initial db tables");
                    tx.executeSql("CREATE TABLE IF NOT EXISTS artists(" +
                        "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "artist TEXT ," +
                        "artistDisambiguation TEXT," +
                        "UNIQUE (artist, artistDisambiguation) ON CONFLICT IGNORE)", []);
                    tx.executeSql("CREATE TABLE IF NOT EXISTS albumArtists(" +
                        "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "albumArtist TEXT ," +
                        "albumArtistDisambiguation TEXT," +
                        "UNIQUE (albumArtist, albumArtistDisambiguation) ON CONFLICT IGNORE)",
                        []);
                    tx.executeSql("CREATE TABLE IF NOT EXISTS albums(" +
                        "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "album TEXT," +
                        "albumArtistId INTEGER," +
                        "UNIQUE (album, albumArtistId) ON CONFLICT IGNORE," +
                        "FOREIGN KEY(albumArtistId) REFERENCES albumArtists(_id))", []);
                    tx.executeSql("CREATE TABLE IF NOT EXISTS artistAlbums(" +
                        "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "albumId INTEGER," +
                        "artistId INTEGER," +
                        "UNIQUE (albumId, artistId) ON CONFLICT IGNORE," +
                        "FOREIGN KEY(albumId) REFERENCES albums(_id)," +
                        "FOREIGN KEY(artistId) REFERENCES artists(_id))", []);
                    tx.executeSql("CREATE TABLE IF NOT EXISTS tracks(" +
                        "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "track TEXT," +
                        "artistId INTEGER," +
                        "albumId INTEGER," +
                        "url TEXT," +
                        "duration INTEGER," +
                        "albumPos INTEGER," +
                        "linkUrl TEXT," +
                        'releaseyear INTEGER,' +
                        'bitrate INTEGER,' +
                        "UNIQUE (track, artistId, albumId) ON CONFLICT IGNORE," +
                        "FOREIGN KEY(artistId) REFERENCES artists(_id)," +
                        "FOREIGN KEY(albumId) REFERENCES albums(_id))", []);
                });
                //m.migration(2, function (tx) {
                //    //Tomahawk.log("Migrating to db version 2");
                //});

                m.execute();
            }
            resolve(this.collection.cachedDbs[this.id]);
        });
    }

    beginTransaction() {
        return this.ensureDb().then((db) => {
            return new RSVP.Promise((resolve, reject) => {
                this.statements = [];
                resolve();
            })
        });
    }

    execDeferredStatements(resolve, reject) {
        this.stmtsToResolve = this.statements.length;
        this.results = this.statements.slice();
        Tomahawk.log('Executing ' + this.stmtsToResolve
            + ' deferred SQL statements in transaction');
        return new RSVP.Promise((resolve, reject) => {
            if (this.statements.length == 0) {
                resolve([]);
            } else {
                this.db.transaction((tx) => {
                    for (var i = 0; i < this.statements.length; ++i) {
                        var stmt = this.statements[i];
                        tx.executeSql(stmt.statement, stmt.args,
                            (function () {
                                //A function returning a function to
                                //capture value of i
                                var originalI = i;
                                return function (tx, results) {
                                    if (typeof this.statements[originalI].map !== 'undefined') {
                                        var map = this.statements[originalI].map;
                                        this.results[originalI] = [];
                                        for (var ii = 0; ii < results.rows.length; ii++) {
                                            this.results[originalI].push(map(
                                                results.rows.item(ii)
                                            ));
                                        }
                                    }
                                    else {
                                        this.results[originalI] = results;
                                    }
                                    this.stmtsToResolve--;
                                    if (this.stmtsToResolve == 0) {
                                        this.statements = [];
                                        resolve(this.results);
                                    }
                                };
                            })(), function (tx, error) {
                                Tomahawk.log("Error in tx.executeSql: " + error.code + " - "
                                    + error.message);
                                this.statements = [];
                                reject(error);
                            }
                        );
                    }
                });
            }
        });
    }

    sql(sqlStatement, sqlArgs, mapFunction) {
        this.statements.push({statement: sqlStatement, args: sqlArgs, map: mapFunction});
    }

    sqlSelect(table, mapResults, fields, where, join) {
        var whereKeys = [];
        var whereValues = [];
        for (var whereKey in where) {
            if (where.hasOwnProperty(whereKey)) {
                whereKeys.push(table + "." + whereKey + " = ?");
                whereValues.push(where[whereKey]);
            }
        }
        var whereString = whereKeys.length > 0 ? " WHERE " + whereKeys.join(" AND ") : "";

        var joinString = "";
        for (var i = 0; join && i < join.length; i++) {
            var joinConditions = [];
            for (var joinKey in join[i].conditions) {
                if (join[i].conditions.hasOwnProperty(joinKey)) {
                    joinConditions.push(table + "." + joinKey + " = " + join[i].table + "."
                        + join[i].conditions[joinKey]);
                }
            }
            joinString += " INNER JOIN " + join[i].table + " ON "
                + joinConditions.join(" AND ");
        }

        var fieldsString = fields && fields.length > 0 ? fields.join(", ") : "*";
        var statement = "SELECT " + fieldsString + " FROM " + table + joinString + whereString;
        return this.sql(statement, whereValues, mapResults);
    }

    sqlInsert(table, fields) {
        var fieldsKeys = [];
        var fieldsValues = [];
        var valuesString = "";
        for (var key in fields) {
            fieldsKeys.push(key);
            fieldsValues.push(fields[key]);
            if (valuesString.length > 0) {
                valuesString += ", ";
            }
            valuesString += "?";
        }
        var statement = "INSERT INTO " + table + " (" + fieldsKeys.join(", ") + ") VALUES ("
            + valuesString + ")";
        return this.sql(statement, fieldsValues);
    }

    sqlDrop(table) {
            var statement = "DROP TABLE IF EXISTS " + table;
            return this.sql(statement, []);
    }
}

export default class Collection {
    constructor() {
        this.cachedDbs = Object.create(null);
    }

    addTracks({id, tracks}) {
        var that = this;

        var cachedAlbumArtists = {},
            cachedArtists = {},
            cachedAlbums = {},
            cachedArtistIds = {},
            cachedAlbumIds = {};

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            // First we insert all artists and albumArtists
            t.sqlInsert("artists", {
                artist: "Various Artists",
                artistDisambiguation: ""
            });
            for (var i = 0; i < tracks.length; i++) {
                tracks[i].track = tracks[i].track || "";
                tracks[i].album = tracks[i].album || "";
                tracks[i].artist = tracks[i].artist || "";
                tracks[i].artistDisambiguation = tracks[i].artistDisambiguation || "";
                tracks[i].albumArtist = tracks[i].albumArtist || "";
                tracks[i].albumArtistDisambiguation = tracks[i].albumArtistDisambiguation || "";
                (function (track) {
                    t.sqlInsert("artists", {
                        artist: track.artist,
                        artistDisambiguation: track.artistDisambiguation
                    });
                    t.sqlInsert("albumArtists", {
                        albumArtist: track.albumArtist,
                        albumArtistDisambiguation: track.albumArtistDisambiguation
                    });
                })(tracks[i]);
            }
            return t.execDeferredStatements();
        }).then(function () {
            // Get all artists' and albumArtists' db ids
            t.sqlSelect("albumArtists", function (r) {
                return {
                    albumArtist: r.albumArtist,
                    albumArtistDisambiguation: r.albumArtistDisambiguation,
                    _id: r._id
                };
            });
            t.sqlSelect("artists", function (r) {
                return {
                    artist: r.artist,
                    artistDisambiguation: r.artistDisambiguation,
                    _id: r._id
                };
            });
            return t.execDeferredStatements();
        }).then(function (resultsArray) {
            // Store the db ids in a map
            var i, row, albumArtists = {};
            for (i = 0; i < resultsArray[0].length; i++) {
                row = resultsArray[0][i];
                albumArtists[row.albumArtist + "♣" + row.albumArtistDisambiguation] = row._id;
            }
            for (i = 0; i < resultsArray[1].length; i++) {
                row = resultsArray[1][i];
                cachedArtists[row.artist + "♣" + row.artistDisambiguation] = row._id;
                cachedArtistIds[row._id] = {
                    artist: row.artist,
                    artistDisambiguation: row.artistDisambiguation
                };
            }

            for (i = 0; i < tracks.length; i++) {
                var track = tracks[i];
                var album = cachedAlbumArtists[track.album];
                if (!album) {
                    album = cachedAlbumArtists[track.album] = {
                        artists: {}
                    };
                }
                album.artists[track.artist] = true;
                var artistCount = Object.keys(album.artists).length;
                if (artistCount == 1) {
                    album.albumArtistId =
                        cachedArtists[track.artist + "♣" + track.artistDisambiguation];
                } else if (artistCount == 2) {
                    album.albumArtistId = cachedArtists["Various Artists♣"];
                }
            }
        }).then(function () {
            // Insert all albums
            for (var i = 0; i < tracks.length; i++) {
                (function (track) {
                    var albumArtistId = cachedAlbumArtists[track.album].albumArtistId;
                    t.sqlInsert("albums", {
                        album: track.album,
                        albumArtistId: albumArtistId
                    });
                })(tracks[i]);
            }
            return t.execDeferredStatements();
        }).then(function () {
            // Get the albums' db ids
            t.sqlSelect("albums", function (r) {
                return {
                    album: r.album,
                    albumArtistId: r.albumArtistId,
                    _id: r._id
                };
            });
            return t.execDeferredStatements();
        }).then(function (results) {
            // Store the db ids in a map
            results = results[0];
            for (var i = 0; i < results.length; i++) {
                var row = results[i];
                cachedAlbums[row.album + "♣" + row.albumArtistId] = row._id;
                cachedAlbumIds[row._id] = {
                    album: row.album,
                    albumArtistId: row.albumArtistId
                };
            }
        }).then(function () {
            // Now we are ready to insert the tracks
            for (var i = 0; i < tracks.length; i++) {
                (function (track) {
                    // Get all relevant ids that we stored in the previous steps
                    var artistId = cachedArtists[track.artist + "♣" + track.artistDisambiguation];
                    var albumArtistId = cachedAlbumArtists[track.album].albumArtistId;
                    var albumId = cachedAlbums[track.album + "♣" + albumArtistId];
                    // Insert the artist <=> album relations
                    t.sqlInsert("artistAlbums", {
                        albumId: albumId,
                        artistId: artistId
                    });
                    // Insert the tracks
                    t.sqlInsert("tracks", {
                        track: track.track,
                        artistId: artistId,
                        albumId: albumId,
                        url: track.url,
                        duration: track.duration,
                        linkUrl: track.linkUrl,
                        releaseyear: track.releaseyear,
                        bitrate: track.bitrate,
                        albumPos: track.albumpos
                    });
                })(tracks[i]);
            }
            return t.execDeferredStatements();
        }).then(function () {
            var resultMap = function (r) {
                return {
                    _id: r._id,
                    artistId: r.artistId,
                    albumId: r.albumId,
                    track: r.track
                };
            };
            // Get the tracks' db ids
            t.sqlSelect("tracks", resultMap, ["_id", "artistId", "albumId", "track"]);
            return t.execDeferredStatements();
        }).then(function (results) {
            this._trackCount = results[0].length;
            Tomahawk.log("Added " + results[0].length + " tracks to collection '" + id + "'");
            // Add the db ids together with the basic metadata to the fuzzy index list
            var fuzzyIndexList = [];
            for (var i = 0; i < results[0].length; i++) {
                var row = results[0][i];
                fuzzyIndexList.push({
                    id: row._id,
                    artist: cachedArtistIds[row.artistId].artist,
                    album: cachedAlbumIds[row.albumId].album,
                    track: row.track
                });
            }
            Tomahawk.createFuzzyIndex(fuzzyIndexList);
        });
    }

    wipe({id}) {
        var that = this;

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            t.sqlDrop("artists");
            t.sqlDrop("albumArtists");
            t.sqlDrop("albums");
            t.sqlDrop("artistAlbums");
            t.sqlDrop("tracks");
            return t.execDeferredStatements();
        }).then(function () {
            return new RSVP.Promise(function (resolve, reject) {
                this.cachedDbs[id].changeVersion(this.cachedDbs[id].version, "", null,
                    function (err) {
                        if (console.error) {
                            console.error("Error!: %o", err);
                        }
                        reject();
                    }, function () {
                        delete this.cachedDbs[id];
                        Tomahawk.deleteFuzzyIndex(id);
                        Tomahawk.log("Wiped collection '" + id + "'");
                        resolve();
                    });
            });
        });
    }

    _fuzzyIndexIdsToTracks(resultIds, id) {
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }
        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            var mapFn = function (row) {
                return {
                    artist: row.artist,
                    artistDisambiguation: row.artistDisambiguation,
                    album: row.album,
                    track: row.track,
                    duration: row.duration,
                    url: row.url,
                    linkUrl: row.linkUrl,
                    releaseyear: row.releaseyear,
                    bitrate: row.bitrate,
                    albumpos: row.albumPos
                };
            };
            for (var idx = 0; resultIds && idx < resultIds.length; idx++) {
                var trackid = resultIds[idx][0];
                var where = {_id: trackid};
                t.sqlSelect("tracks", mapFn,
                    [],
                    where, [
                        {
                            table: "artists",
                            conditions: {
                                artistId: "_id"
                            }
                        }, {
                            table: "albums",
                            conditions: {
                                albumId: "_id"
                            }
                        }
                    ]
                );
            }
            return t.execDeferredStatements();
        }).then(function (results) {
            var merged = [];
            return merged.concat.apply(merged,
                results.map(function (e) {
                    //every result has one track
                    return e[0];
                }));
        });
    }

    resolve({artist, album, track}) {
        var resultIds = Tomahawk.resolveFromFuzzyIndex(artist, album, track);
        return this._fuzzyIndexIdsToTracks(resultIds);
    }

    search({query}) {
        var resultIds = Tomahawk.searchFuzzyIndex(query);
        return this._fuzzyIndexIdsToTracks(resultIds);
    }

    tracks({id, where}) {
        //TODO filter/where support
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            var mapFn = function (row) {
                return {
                    artist: row.artist,
                    artistDisambiguation: row.artistDisambiguation,
                    album: row.album,
                    track: row.track,
                    duration: row.duration,
                    url: row.url,
                    linkUrl: row.linkUrl,
                    releaseyear: row.releaseyear,
                    bitrate: row.bitrate,
                    albumpos: row.albumPos
                };
            };
            t.sqlSelect("tracks", mapFn,
                [],
                where, [
                    {
                        table: "artists",
                        conditions: {
                            artistId: "_id"
                        }
                    }, {
                        table: "albums",
                        conditions: {
                            albumId: "_id"
                        }
                    }
                ]
            );
            return t.execDeferredStatements();
        }).then(function (results) {
            return {results: resolverInstance._convertUrls(results[0])};
        });
    }

    albums({id, where}) {
        //TODO filter/where support
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            var mapFn = function (row) {
                return {
                    albumArtist: row.artist,
                    albumArtistDisambiguation: row.artistDisambiguation,
                    album: row.album
                };
            };
            t.sqlSelect("albums", mapFn,
                ["album", "artist", "artistDisambiguation"],
                where, [
                    {
                        table: "artists",
                        conditions: {
                            albumArtistId: "_id"
                        }
                    }
                ]
            );
            return t.execDeferredStatements();
        }).then(function (results) {
            results = results[0].filter(function (e) {
                return (e.albumArtist != '' && e.album != '');
            });
            return {
                artists: results.map(function (i) {
                    return i.albumArtist;
                }),
                albums: results.map(function (i) {
                    return i.album;
                })
            };
        });
    }

    artists({id, where}) {
        //TODO filter/where support
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            var mapFn = function (r) {
                return r.artist;
            };
            t.sqlSelect("artists", mapFn, ["artist", "artistDisambiguation"]);
            return t.execDeferredStatements();
        }).then(function (artists) {
            return {artists: artists[0]};
        });
    }

    //TODO: not exactly sure how is this one supposed to work
    //albumArtists: function (params) {
    //var id = params.id;

    //var t = new Transaction(this, id);
    //return t.beginTransaction().then(function () {
    //var mapFn = function(row) {
    //return {
    //albumArtist: row.albumArtist,
    //albumArtistDisambiguation: row.albumArtistDisambiguation
    //};
    //};
    //t.sqlSelect("albumArtists", ["albumArtist", "albumArtistDisambiguation"]);
    //return t.execDeferredStatements();
    //}).then(function (results) {
    //return results[0];
    //});
    //},

    artistAlbums({id, where}) {
        //TODO filter/where support
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }
        var artist = params.artist;
        //var artistDisambiguation = params.artistDisambiguation;

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {

            t.sqlSelect("artists", function (r) {
                return r._id;
            }, ["_id"], {
                artist: artist
                //artistDisambiguation: artistDisambiguation
            });
            return t.execDeferredStatements();
        }).then(function (results) {
            var artistId = results[0][0];
            t.sqlSelect("artistAlbums", function (r) {
                return r.album;
            }, ["albumId", 'album'], {
                artistId: artistId
            }, [
                {
                    table: "albums",
                    conditions: {
                        albumId: "_id"
                    }
                }
            ]);
            return t.execDeferredStatements();
        }).then(function (results) {
            return {
                artist: artist,
                albums: results[0]
            };
        });
    }

    albumTracks({id, where}) {
        //TODO filter/where support
        if (typeof id === 'undefined') {
            id = this.settings.id;
        }
        var albumArtist = params.artist;
        //var albumArtistDisambiguation = params.albumArtistDisambiguation;
        var album = params.album;

        var that = this;

        var t = new Transaction(this, id);
        return t.beginTransaction().then(function () {
            t.sqlSelect("artists", function (r) {
                return r._id;
            }, ["_id"], {
                artist: albumArtist
                //artistDisambiguation: albumArtistDisambiguation
            });
            return t.execDeferredStatements();
        }).then(function (results) {
            var albumArtistId = results[0][0];
            t.sqlSelect("albums", function (r) {
                return r._id;
            }, ["_id"], {
                album: album,
                albumArtistId: albumArtistId
            });
            return t.execDeferredStatements();
        }).then(function (results) {
            var albumId = results[0][0];
            return this.tracks(params, {
                albumId: albumId
            });
        });
    }

    collection() {
        this.settings.trackcount = this._trackCount;
        if (!this.settings.description) {
            this.settings.description = this.settings.prettyname;
        }
        this.settings.capabilities = [Tomahawk.Collection.BrowseCapability.Artists,
            Tomahawk.Collection.BrowseCapability.Albums,
            Tomahawk.Collection.BrowseCapability.Tracks];
        return this.settings;
    }
}
