var buster = require("buster");
var TomahawkJS = require("tomahawkjs");

buster.testCase("soundcloud", {
    setUp: function (done) {
        var that = this;
        // TODO: Make this path dynamic, maybe even freshly built the resolver first.
        TomahawkJS.loadAxe('soundcloud/soundcloud-0.9.5.axe', function(err, axe) {
            axe.getInstance(function(err, instance_context) {
                that.instance = instance_context.instance;
                that.context = instance_context.context;
                that.instance.init(function (error) {
                    if (error) {
                        // TODO Loading failed, crash!
                    } else {
                        // Resolver loaded successfully, start testing.
                        done();
                    }
                });
            });
        });
    },

    "test capabilities": function () {
        buster.assert(this.context.hasCapability('urllookup'));
        buster.refute(this.context.hasCapability('playlistsync'));
        buster.refute(this.context.hasCapability('browsable'));
    },

    "test resolving": function (done) {
        this.context.on('track-result', function (qid, result) {
            buster.assert.equals("qid-001", qid);
            buster.assert.equals("Bloc Party", result.artist);
            buster.assert.equals("Ratchet", result.track);
            // console.log(JSON.stringify(result));
            done();
        });
        // TODO: Mock web requests.
        this.instance.resolve("qid-001", "Bloc Party", "", "Ratchet");
    }
});

