var argv = require('minimist')(process.argv.slice(2));
var utils = require('../test/utils.js');

if (argv._.length < 1) {
    console.error("Please specify a single resolver");
    process.exit(1);
}

if (argv._.length < 2) {
    console.error("You need to specify an URL which shall be looked up.");
    process.exit(1);
}

// We use the string argument as the path to the resolver.
var resolverPath = argv._[0];
var url = argv._[1];

// All -/-- arguments will be added to the config.
// TODO: Add an agurment to load the config from a file.
var resolverConfig = argv;
if (argv.hasOwnProperty("config")) {
    // FIXME: Add support for absolute paths
    resolverConfig = require("../" + argv.config);
} else {
    delete resolverConfig._;
}

var resolver = {};

utils.loadAxe(resolverPath, resolver, function () {
    if (!resolver.context.hasCapability('urllookup')) {
        console.error("Resolver does not support URLLookup.");
    } else {
        resolver.context.on('url-result', function (url, result) {
            console.dir(result);
        });

        if (resolver.instance.canParseUrl(url)) {
            resolver.instance.lookupUrl(url);
        } else {
            console.error("Resolver cannot lookup URLs of the given type.");
        }
    }
}, resolverConfig);
