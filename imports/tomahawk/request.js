//Statuses considered a success for HTTP request
var httpSuccessStatuses = [200, 201];

/**
 * Possible options:
 *  - method: The HTTP request method (default: GET)
 *  - username: The username for HTTP Basic Auth
 *  - password: The password for HTTP Basic Auth
 *  - errorHandler: callback called if the request was not completed
 *  - data: body data included in POST requests
 *  - needCookieHeader: boolean indicating whether or not the request needs to be able to get the
 *                      "Set-Cookie" response header
 */
var asyncRequest = function (url, callback, extraHeaders, options) {
    // unpack options
    var opt = options || {};
    var method = opt.method || 'GET';

    if (environment.shouldDoNativeRequest(url, callback, extraHeaders, options)) {
        // Assign a request Id to the callback so we can use it when we are
        // returning from the native call.
        var reqId = Tomahawk.asyncRequestIdCounter;
        Tomahawk.asyncRequestIdCounter++;
        Tomahawk.asyncRequestCallbacks[reqId] = {
            callback: callback,
            errorHandler: opt.errorHandler
        };
        Tomahawk.nativeAsyncRequest(reqId, url, extraHeaders, options);
    } else {
        var xmlHttpRequest = new XMLHttpRequest();
        xmlHttpRequest.open(method, url, true, opt.username, opt.password);
        if (extraHeaders) {
            for (var headerName in extraHeaders) {
                xmlHttpRequest.setRequestHeader(headerName, extraHeaders[headerName]);
            }
        }
        xmlHttpRequest.onreadystatechange = function () {
            if (xmlHttpRequest.readyState == 4
                && httpSuccessStatuses.indexOf(xmlHttpRequest.status) != -1) {
                callback.call(window, xmlHttpRequest);
            } else if (xmlHttpRequest.readyState === 4) {
                Tomahawk.log("Failed to do " + method + " request: to: " + url);
                Tomahawk.log("Status Code was: " + xmlHttpRequest.status);
                if (opt.hasOwnProperty('errorHandler')) {
                    opt.errorHandler.call(window, xmlHttpRequest);
                }
            }
        };
        xmlHttpRequest.send(opt.data || null);
    }
};

/**
 * This method is externalized from Tomahawk.asyncRequest, so that other clients
 * (like tomahawk-android) can inject their own logic that determines whether or not to do a request
 * natively.
 *
 * @returns boolean indicating whether or not to do a request with the given parameters natively
 */
window.environment = window.environment || {};
environment.shouldDoNativeRequest = environment.shouldDoNativeRequest ||  function (url, callback, extraHeaders, options) {
    return (extraHeaders && (extraHeaders.hasOwnProperty("Referer")
    || extraHeaders.hasOwnProperty("referer")
    || extraHeaders.hasOwnProperty("User-Agent")));
};

export default function ajax(url, settings) {
    if (typeof url === "object") {
        settings = url;
    } else {
        settings = settings || {};
        settings.url = url;
    }

    settings.type = settings.type || settings.method || 'get';
    settings.method = settings.type;
    settings.dataFormat = settings.dataFormat || 'form';

    if (settings.data) {
        var formEncode = function (obj) {
            var str = [];
            for (var p in obj) {
                if (obj[p] !== undefined) {
                    if (Array.isArray(obj[p])) {
                        for (var i = 0; i < obj[p].length; i++) {
                            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p][i]));
                        }
                    } else {
                        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                    }
                }
            }

            str.sort();

            return str.join("&");
        };
        if (typeof settings.data === 'object') {
            if (settings.dataFormat == 'form') {
                settings.data = formEncode(settings.data);
                settings.contentType = settings.contentType || 'application/x-www-form-urlencoded';
            } else if (settings.dataFormat == 'json') {
                settings.data = JSON.stringify(settings.data);
                settings.contentType = settings.contentType || 'application/json';
            } else {
                throw new Error("Tomahawk: ajax: unknown dataFormat requested: "
                    + settings.dataFormat);
            }
        } else {
            throw new Error("Tomahawk: ajax: data should be either object or string");
        }

        if (settings.type.toLowerCase() === 'get') {
            settings.url += '?' + settings.data;
            delete settings.data;
        } else {
            settings.headers = settings.headers || {};
            if (!settings.headers.hasOwnProperty('Content-Type')) {
                settings.headers['Content-Type'] = settings.contentType;
            }
        }
    }

    return new RSVP.Promise(function (resolve, reject) {
        settings.errorHandler = reject;
        asyncRequest(settings.url, resolve, settings.headers, settings);
    }).then(function (xhr) {
            if (settings.rawResponse) {
                return xhr;
            }
            var responseText = xhr.responseText;
            var contentType;
            if (settings.dataType === 'json') {
                contentType = 'application/json';
            } else if (settings.dataType === 'xml') {
                contentType = 'text/xml';
            } else if (typeof xhr.getResponseHeader !== 'undefined') {
                contentType = xhr.getResponseHeader('Content-Type');
            } else if (xhr.hasOwnProperty('contentType')) {
                contentType = xhr['contentType'];
            } else {
                contentType = 'text/html';
            }

            if (~contentType.indexOf('application/json')) {
                return JSON.parse(responseText);
            }

            if (~contentType.indexOf('text/xml')) {
                var domParser = new DOMParser();
                return domParser.parseFromString(responseText, "text/xml");
            }

            return xhr.responseText;
        });
};

export function post(url, settings) {
    if (typeof url === "object") {
        settings = url;
    } else {
        settings = settings || {};
        settings.url = url;
    }

    settings.method = 'POST';

    return ajax(settings);
};

export function get(url, settings) {
    return ajax(url, settings);
};
