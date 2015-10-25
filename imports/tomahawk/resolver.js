export default class Resolver {
    scriptPath() {
        return Tomahawk.resolverData().scriptPath;
    }

    getConfigUi() {
        return {};
    }

    getUserConfig() {
        return JSON.parse(window.localStorage[this.scriptPath()] || "{}");
    }

    saveUserConfig() {
        window.localStorage[this.scriptPath()] = JSON.stringify(Tomahawk.resolverData().config);
        this.newConfigSaved(Tomahawk.resolverData().config);
    }

    newConfigSaved() {
    }

    getStreamUrl(params) {
        return params;
    }

    getSettings() {
        return this.settings;
    }

    _convertUrls(results) {
        var that = this;
        return results.map(function (r) {
            if (r && r.url) {
                r.url = that._urlProtocol + '://' + r.url;
            }
            return r;
        });
    }

    _adapter_resolve(qid, artist, album, title) {
        var that = this;
        var collectionPromises = [];
        Tomahawk.collections.forEach(function (col) {
            if (col.resolve) {
                collectionPromises.push(col.resolve({artist: artist, album: album, track: title}));
            }
        });
        RSVP.Promise.all(collectionPromises).then(function (collectionResults) {
            var merged = [];
            return merged.concat.apply(merged, collectionResults);
        }).then(function (collectionResults) {
            RSVP.Promise.resolve(that.resolve({
                artist: artist,
                album: album,
                track: title
            })).then(function (results) {
                Tomahawk.addTrackResults({
                    'qid': qid,
                    'results': that._convertUrls(results.concat(collectionResults))
                });
            });
        });
    }

    _adapter_init() {
        this._urlProtocol = this.settings.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
        Tomahawk.addCustomUrlHandler(this._urlProtocol, 'getStreamUrl', true);
        Tomahawk.log('Registered custom url handler for protocol "' + this._urlProtocol + '"');
        this.init();
    }

    _adapter_getStreamUrl(params) {
        params.url = params.url.slice(this._urlProtocol.length + 3);
        RSVP.Promise.resolve(this.getStreamUrl(params)).then(function (result) {
            Tomahawk.reportStreamUrl(params.qid, result.url, result.headers);
        });
    }

    _adapter_search(qid, query) {
        var that = this;
        var collectionPromises = [];
        Tomahawk.collections.forEach(function (col) {
            if (col.search) {
                collectionPromises.push(col.search({query: query}));
            }
        });
        RSVP.Promise.all(collectionPromises).then(function (collectionResults) {
            var merged = [];
            return merged.concat.apply(merged, collectionResults);
        }).then(function (collectionResults) {
            RSVP.Promise.resolve(that.search({query: query})).then(function (results) {
                Tomahawk.addTrackResults({
                    'qid': qid,
                    'results': that._convertUrls(results.concat(collectionResults))
                });
            });
        });
    }

    _adapter_testConfig(config) {
        return RSVP.Promise.resolve(this.testConfig(config)).then(function () {
            return {result: Tomahawk.ConfigTestResultType.Success};
        });
    }
};
