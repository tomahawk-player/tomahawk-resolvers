import RSVP from 'rsvp';

export default class PluginManager {
    constructor() {
        this.objects = {};
        this.resolve = [];
        this.objectCounter = 0;
    }


    identifyObject(object) {
        if (!object.hasOwnProperty('id')) {
            object.id = this.objectCounter++;
        }

        return object.id;
    }
    registerPlugin(type, object) {
        this.objects[this.identifyObject(object)] = object;
        if (type === 'collection') {
            Tomahawk.collections.push(object);
        }

        Tomahawk.log("registerPlugin: " + type + " id: " + object.id);
        Tomahawk.registerScriptPlugin(type, object.id);
    }

    unregisterPlugin(type, object) {
        this.objects[this.identifyObject(object)] = object;

        Tomahawk.log("unregisterPlugin: " + type + " id: " + object.id);
        Tomahawk.unregisterScriptPlugin(type, object.id);
    }

    invokeSync(requestId, objectId, methodName, params) {
        if (!window.resolverInstance.apiVersion || window.resolverInstance.apiVersion < 0.9) {
            if (methodName === 'artistAlbums') {
                methodName = 'albums';
            } else if (methodName === 'albumTracks') {
                methodName = 'tracks';
            }
        }

        var pluginManager = this;
        if (!this.objects[objectId]) {
            Tomahawk.log("Object not found! objectId: " + objectId + " methodName: " + methodName);
        } else {
            if (!this.objects[objectId][methodName]) {
                Tomahawk.log("Function not found: " + methodName);
            }
        }

        if (typeof this.objects[objectId][methodName] === 'function') {
            if (!window.window.resolverInstance.apiVersion
                || window.window.resolverInstance.apiVersion < 0.9) {
                if (methodName == 'artists') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.artists(requestId);
                    });
                } else if (methodName == 'albums') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.albums(requestId, params.artist);
                    });
                } else if (methodName == 'tracks') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.tracks(requestId, params.artist, params.album);
                    });
                } else if (methodName == 'lookupUrl') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[params.url] = resolve;
                        window.resolverInstance.lookupUrl(params.url);
                    });
                } else if (methodName == 'getStreamUrl') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.getStreamUrl(requestId, params.url);
                    });
                } else if (methodName == 'resolve') {
                    console.log('RESOLVE WAAAAAAAAAAT');
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.resolve(requestId, params.artist,
                            params.album, params.track);
                    });
                } else if (methodName == 'search') {
                    return new RSVP.Promise(function (resolve, reject) {
                        pluginManager.resolve[requestId] = resolve;
                        window.resolverInstance.search(requestId, params.query);
                    });
                }
            }

            return this.objects[objectId][methodName](params);
        }

        return this.objects[objectId][methodName];
    }

    invoke(requestId, objectId, methodName, params) {
        RSVP.Promise.resolve(this.invokeSync(requestId, objectId, methodName, params))
            .then(function (result) {
                Tomahawk.reportScriptJobResults({
                    requestId: requestId,
                    data: result
                });
            }, function (error) {
                Tomahawk.reportScriptJobResults({
                    requestId: requestId,
                    error: error
                });
            });
    }
}
