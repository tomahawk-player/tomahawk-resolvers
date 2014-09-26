// var process = require('process');
var utils = require("../../test/utils.js");

var username = process.argv[2];
var password = process.argv[3];
var artist = process.argv[4];
var track = process.argv[5];

var owner = {};

// We have the relevant credentials, so get a resolver instance.
utils.loadResolver('beatsmusic', owner, function (err) {
    if (err) {
        console.log("Error on creating a resolver instance:");
        console.log(err);
        process.exit(1);
    }

    owner.context.once('track-result', function (qid, result) {
        owner.context.getStreamUrl(2, result.url);
    });
    owner.context.once('stream-url', function (qid, url) {
        console.log(url);
    });
    owner.instance.resolve(1, artist, "", track);
}, {
    user: username,
    password: password
});
