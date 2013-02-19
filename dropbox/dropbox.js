var DropboxResolver = Tomahawk.extend(TomahawkResolver, {
	oauth: null,
	uid: '',
	cursor: '',
	 
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
            fields: [{
                name: "associateButton",
                widget: "associateButton",
                property: "text",
                connections : [ { 
                		  signal: "clicked()", 
                		  javascriptCallback: "resolver.associateClicked();" 
                		}]                
            },
            {
                name: "deleteButton",
                widget: "deleteButton",
                property: "text",
                connections : [ { 
                		  signal: "clicked()", 
                		  javascriptCallback: "resolver.deleteClicked();" 
                		}]                
            },],
            images: [{
                "dropbox.png": Tomahawk.readBase64("dropbox.png")
            }, ]
        };
    },
        
    newConfigSaved: function () {
    },
    
    associateClicked: function () {
       Tomahawk.log("Associate was clicked");
       this.oauth.fetchRequestToken(this.openAcceptPage, this.queryFailure);
    },
    
    deleteClicked: function () {
       Tomahawk.log("Delete was clicked");
    },
    
    openAcceptPage: function(url) { 	
    	Tomahawk.requestWebView("acceptPage", url);
    	
    	//acceptPage.setWindowModality(2);
    	//acceptPage.resize(acceptPage.height(), 800);

    	acceptPage.show();
    	acceptPage.urlChanged.connect(Tomahawk.resolver.instance, function(url){
										 					  		  this.onUrlChanged(url.toString());
																  });
    },
    
    onUrlChanged: function(url){
    	Tomahawk.log("URL returned : \'" + url+"\'"); 
    	
    	if(url === 'https://www.dropbox.com/1/oauth/authorize'){
    		this.oauth.fetchAccessToken(this.onAccessTokenReceived, this.queryFailure);
		}
		
    	if(url === 'https://www.dropbox.com/home'){ 
    		Tomahawk.log("Refused");
    		//close webpage
		}
	},
	
	onAccessTokenReceived: function(data){	
		//parse response
        var i = 0, arr = data.text.split('&'), len = arr.length, obj = {};
		for (; i < len; ++i) {
		    var pair = arr[i].split('=');
		    obj[OAuth.urlDecode(pair[0])] = OAuth.urlDecode(pair[1]);
		}
		
		//TODO close webpage
		Tomahawk.log("Setting DB");

 		window.localStorage.setItem('accessTokenKey',obj.oauth_token);
		window.localStorage.setItem('accessTokenSecret',obj.oauth_token_secret);
		window.localStorage.setItem('cursor','');
		
		Tomahawk.log("DB setted");
		this.updateDatabase();
	},
	
    queryFailure: function(data) {
    	Tomahawk.log("Request Failed : " + data);
    },
    
    init: function () {
        Tomahawk.log("Beginnning INIT of Dropbox resovler");
        		Tomahawk.log(this.db.setItem);
        Tomahawk.addLocalJSFile('jsOAuth-1.3.6.min.js');
        //Tomahawk.addLocalJSFile("musicManager.js");
        
        this.cursor = this.db.getItem('cursor','');
        
        this.oauth = OAuth({
                               consumerKey: '7scivkf1tstl8dl',
                               consumerSecret: 'lu05s08m19h0dib',
                               requestTokenUrl:	'https://api.dropbox.com/1/oauth/request_token',
                               authorizationUrl: 'https://www.dropbox.com/1/oauth/authorize',
                               accessTokenUrl: 'https://api.dropbox.com/1/oauth/access_token',
                               accessTokenKey: this.db.getItem('accessTokenKey',''),
                               accessTokenSecret: this.db.getItem('accessTokenSecret','')
                          });

		//TODO updateDatabase every 30 min (and handle if a user asked for a DB refresh before)
  		this.updateDatabase();
    },
    
    updateDatabase: function(){
    	Tomahawk.log("Sending Delta Query : ");
		this.oauth.postJSON('https://api.dropbox.com/1/delta', {'cursor': ''}, this.deltaCallback, this.queryFailure);
    },
    
    deltaCallback: function(response){
    	//TODO set cursor in DB
    	Tomahawk.log("Delta results : ");
    	Tomahawk.log(response.text);
    },
    
    db: {
			setItem: window.localStorage.setItem,
			getItem: function (key, defaultResponse){
			 			var result = window.localStorage.getItem(key);
			 			result = (result == null)? defaultResponse : result;
			 			
			 			Tomahawk.log("DB: loaded "+key+" : '"+ result+"' ");
			 			
			 			return result; 
 					}	
	},
    
    resolve: function (qid, artist, album, title) {
       //this.doSearchOrResolve(qid, title, 1);
    },

    search: function (qid, searchString) {
       //this.doSearchOrResolve(qid, searchString, 15);
    },
    
    artists: function( qid )
    {
        
    },

    albums: function( qid, artist )
    {

    },

    tracks: function( qid, artist, album )
    {

    }
});

Tomahawk.resolver.instance = DropboxResolver;
