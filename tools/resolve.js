var argv = require('minimist')(process.argv.slice(2));
var utils = require('../test/utils.js');

if (argv._.length < 1) {
    console.error("Please specify a single resolver");
    process.exit(1);
}

if (argv._.length < 3) {
    console.error("You need to specify at least an artist and a track for resolving.");
    process.exit(1);
}

// We use the string argument as the path to the resolver.
var resolverPath = argv._[0];
var artist = argv._[1];
var track = argv._[2];
var album = "";

if (argv._.length > 3) {
    album = argv._[3];
}

// All -/-- arguments will be added to the config.
// TODO: Add an agurment to load the config from a file.
var resolverConfig = argv;
delete resolverConfig._;

var resolver = {};

utils.loadAxe(resolverPath, resolver, function () {
    resolver.context.on('track-result', function (qid, result) {
        console.dir(result);
    });
    resolver.instance.resolve("qid", artist, album, track);
}, resolverConfig);
