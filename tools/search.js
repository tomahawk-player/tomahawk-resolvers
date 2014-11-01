var argv = require('minimist')(process.argv.slice(2));
var utils = require('../test/utils.js');

if (argv._.length < 1) {
    console.error("Please specify a single resolver");
    process.exit(1);
}

if (argv._.length < 2) {
    console.error("You need to specify at least some characters to search for.");
    process.exit(1);
}

// We use the string argument as the path to the resolver.
var resolverPath = argv._.shift();
// All other arguments are passed as the search query
var searchQuery = argv._.join(" ");

// All -/-- arguments will be added to the config.
// If --config is specified, we will instead load them from the config file.
var resolverConfig = argv;
if (argv.hasOwnProperty("config")) {
    // FIXME: Add support for absolute paths
    resolverConfig = require("../" + argv.config);
} else {
    delete resolverConfig._;
}

var resolver = {};

utils.loadAxe(resolverPath, resolver, function () {
    resolver.context.on('track-result', function (qid, result) {
        console.dir(result);
    });
    resolver.instance.search("qid", searchQuery);
}, resolverConfig);
