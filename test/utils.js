var fs = require('fs');
var TomahawkJS = require("tomahawkjs");

module.exports.loadResolver = function (name, owner, done) {
    owner.metadata = JSON.parse(fs.readFileSync(name + '/content/metadata.json'))
    TomahawkJS.loadAxe(name + '/' + name + '-' + owner.metadata.version + '.axe', function(err, axe) {
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
        });
    });
};
