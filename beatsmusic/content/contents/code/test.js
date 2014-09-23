var buster = require("buster");
var nock = require("nock");
var utils = require("../../../../test/utils.js");

buster.testCase("beatsmusic", {
    setUp: function (done) {
        nock("https://partner.api.beatsmusic.com")
            .post("/api/o/oauth2/approval")
            .times(2)
            .reply(200, JSON.stringify({
                "access_token": "testToken"
            }));
        utils.loadResolver('beatsmusic', this, done, {
            user: "TestUser",
            password: "TestPassword"
        });
    },

    "test capabilities": function () {
        buster.assert(this.context.hasCapability('urllookup'));
        buster.refute(this.context.hasCapability('playlistsync'));
        buster.refute(this.context.hasCapability('browsable'));
    }
});

