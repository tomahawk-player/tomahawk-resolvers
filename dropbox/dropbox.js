var DropboxResolver = Tomahawk.extend(TomahawkResolver, {

    settings: {
        name: 'Dropbox',
        weight: 60,
	icon : 'dropbox.png',
        timeout: 15
    },
    
    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {

            "widget": uiData,
            fields: [/*{
                name: "username",
                widget: "usernameLineEdit",
                property: "text"
            }, {
                name: "password",
                widget: "passwordLineEdit",
                property: "text"
            }, */],
            images: [{
                "dropbox.png": Tomahawk.readBase64("dropbox.png")
            }, ]
        };
    },
        
    newConfigSaved: function () {
	//Tomahawk.log("Trying to open a webpage");
    	//Tomahawk.openURL("http://google.fr");
    	//window.open("http://google.fr");
    	//Tomahawk.log("Page opened");
    },
    
    resolve: function (qid, artist, album, title) {
       //this.doSearchOrResolve(qid, title, 1);
    },
    search: function (qid, searchString) {
       //this.doSearchOrResolve(qid, searchString, 15);
    }
});

Tomahawk.resolver.instance = DropboxResolver;
