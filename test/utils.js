var fs = require('fs');
var TomahawkJS = require("tomahawkjs");

module.exports.loadAxe = function(path, owner, done, config) {
    TomahawkJS.loadAxe(path, function(err, axe) {
        axe.getInstance(function(err, instance_context) {
            owner.instance = instance_context.instance;
            owner.context = instance_context.context;
            owner.instance.init(function (error) {
                if (error) {
                    // TODO Loading failed, crash!
                } else {
                    // Resolver loaded successfully, start testing.
                    done();
                }
            });
        }, config);
    });
};

module.exports.loadResolver = function (name, owner, done, config) {
    owner.metadata = JSON.parse(fs.readFileSync(name + '/content/metadata.json'))
    module.exports.loadAxe(name + '/' + name + '-' + owner.metadata.version + '.axe', owner, done, config);
};

