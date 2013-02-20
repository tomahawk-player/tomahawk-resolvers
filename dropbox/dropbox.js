var DropboxResolver = Tomahawk.extend(TomahawkResolver, {
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
       this.oauth.associate(this.updateDatabase);
    },
    
    deleteClicked: function () {
       Tomahawk.log("Delete was clicked");
       
       this.cursor = '';
	   db.setItem('cursor','');
       
       this.oauth.deleteAssociation();
       
    },
    
    queryFailure: function(data) {
    	Tomahawk.log("Request Failed : " + data.text);
    },
    
    init: function () {
        Tomahawk.log("Beginnning INIT of Dropbox resovler");
        Tomahawk.addLocalJSFile('jsOAuth-1.3.6.min.js');
        //Tomahawk.addLocalJSFile("musicManager.js");
        
        this.cursor = db.getItem('cursor','');
        
        this.oauth.init();

		//TODO updateDatabase every 30 min (and handle if a user asked for a DB refresh before)
		//TODO update only if asscociated to an account
  		this.updateDatabase();
    },
    
    updateDatabase: function(){
    	Tomahawk.log("Sending Delta Query : ");
		this.oauth.opostJSON('https://api.dropbox.com/1/delta', {'cursor': ''}, this.deltaCallback, this.queryFailure);
    },
    
    deltaCallback: function(response){
    	//TODO set cursor in DB
    	Tomahawk.log("Delta returned!");
    	Tomahawk.log("Cursor : " + response.cursor);
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

    },
    
    oauth: {
    
    	init: function(){
    		this.oauthSettings.accessTokenKey = db.getItem('accessTokenKey','');
    		this.oauthSettings.accessTokenSecret = db.getItem('accessTokenSecret','');
    		
    		this.oauthEngine = OAuth(this.oauthSettings);
    	},
    
    	//associate a new User
    	//If the association is succesfull the previous token is discarded
    	associate: function(callback){
    		this.oauthEngine.fetchRequestToken(function(data){
													this.resolver.oauth.openAcceptPage(data, callback);
											   }, this.queryFailure);
    	},
    	
    	deleteAssociation: function(){
	 		db.setItem('accessTokenKey','');
			db.setItem('accessTokenSecret','');
			
			this.oauthSettings.accessTokenKey = '';
			this.oauthSettings.accessTokenSecret = '';
			
			this.oauthEngine = OAuth(this.oauthSettings);
			
    	},
    	
    	isAssociated: function(){
    		var accessKey = db.getItem('accessTokenKey','');
    		var accessSecret = db.getItem('accessTokenSecret','');
    		return( !(accessKey === '') &&  !(accessSecret === '') );
    	},
    	
    	opostJSON: function(url, data, success, failure){
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Post to "+ url + " : No account associated");
			}else{
				this.oauthEngine.postJSON(url, data, success, failure);
			}
    	},
    	
    	ogetJSON: function(url, success, failure){
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Get to "+ url + " : No account associated");
			}else{
				this.oauthEngine.getJSON(url, success, failure);
			}
    	},
    	
    	//Private member
    	oauthEngine: null,
    	
    	oauthSettings: {
		                   consumerKey: '7scivkf1tstl8dl',
		                   consumerSecret: 'lu05s08m19h0dib',
		                   requestTokenUrl:	'https://api.dropbox.com/1/oauth/request_token',
		                   authorizationUrl: 'https://www.dropbox.com/1/oauth/authorize',
		                   accessTokenUrl: 'https://api.dropbox.com/1/oauth/access_token',
		                   accessTokenKey: '',
		                   accessTokenSecret: '' 
        },
        
        openAcceptPage: function(url, callback) {
			Tomahawk.requestWebView("acceptPage", url);
			
			//acceptPage.setWindowModality(2);
			//acceptPage.resize(acceptPage.height(), 800);

			acceptPage.show();
			acceptPage.urlChanged.connect(Tomahawk.resolver.instance.oauth, function(url){
												 					  		  this.onUrlChanged(url.toString(), callback);
																		  });
    	},
    	
	    onUrlChanged: function(url, callback){
			Tomahawk.log("URL returned : \'" + url+"\'"); 
			
			if(url === 'https://www.dropbox.com/1/oauth/authorize'){
				this.oauthEngine.fetchAccessToken(function(data){
													this.resolver.oauth.onAccessTokenReceived(data, callback);
											 	}, this.queryFailure);
			}
		
			if(url === 'https://www.dropbox.com/home'){ 
				Tomahawk.log("Refused");
				//close webpage
			}
		},
	
		onAccessTokenReceived: function(data, callback){	
			//parse response
		    var i = 0, arr = data.text.split('&'), len = arr.length, obj = {};
			for (; i < len; ++i) {
				var pair = arr[i].split('=');
				obj[OAuth.urlDecode(pair[0])] = OAuth.urlDecode(pair[1]);
			}
		
			//TODO close webpage

			this.oauthSettings.accessTokenKey = obj.oauth_token;
			this.oauthSettings.accessTokenSecret = obj.oauth_token_secret;

	 		db.setItem('accessTokenKey',obj.oauth_token);
			db.setItem('accessTokenSecret',obj.oauth_token_secret);
		
			if(! (typeof callback === 'undefined')){
				callback.call(Tomahawk.resolver.instance);
			}
		},
        
        queryFailure: function(data) {
    		Tomahawk.log("Request Failed : " + data.text);
    	}

    }
});

var db = {
			setItem: function(a1, a2){
						window.localStorage.setItem(a1,a2);
					},
			getItem: function (key, defaultResponse){
			 			var result = window.localStorage.getItem(key);
			 			result = (result == null)? defaultResponse : result;
			 			
			 			Tomahawk.log("DB: loaded "+key+" : '"+ result+"' ");
			 			
			 			return result; 
					 }	
};

Tomahawk.resolver.instance = DropboxResolver;
