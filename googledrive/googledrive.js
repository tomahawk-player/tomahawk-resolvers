var GoogleDriveResolver = Tomahawk.extend(TomahawkResolver, {
	uid: '',
	cursor: '',
	maxResults: '150',
	 
    settings: {
        name: 'Google Drive',
        weight: 60,
        icon : 'googledrive.png',
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
                "googledrive.png": Tomahawk.readBase64("googledrive.png")
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
        Tomahawk.log("Beginnning INIT of Google Drive resovler");

        //Tomahawk.addLocalJSFile("musicManager.js");
        
        this.cursor = db.getItem('cursor','');
        
        this.oauth.init();

		//TODO updateDatabase every 30 min (and handle if a user asked for a DB refresh before)
		//TODO update only if asscociated to an account
  		this.updateDatabase();
    },
    
    updateDatabase: function(){
    	Tomahawk.log("Sending Delta Query : ");
    	var url = 'https://www.googleapis.com/drive/v2/changes?'
    			  +'maxResults=' + this.maxResults
    			  +'&pageToken=1'; 
		this.oauth.ogetJSON(url, this.deltaCallback);
    },
    
    deltaCallback: function(response){
    	//TODO set cursor in DB
    	Tomahawk.log("Delta returned!");
    	Tomahawk.log("Cursor : " + response.selfLink);
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
    		this.accessToken = db.getItem('accessToken','');
    		this.refreshToken = db.getItem('refreshToken','');
    		this.expiresOn = db.getItem('expiresOn','');
    	},
    
    	//associate a new User
    	//If the association is succesfull the previous token is discarded
    	associate: function(callback){
    		var url = this.oauthUrl + '?response_type=code&client_id=' + this.clientId + '&redirect_uri=' + this.redirectUri + '&scope=' + this.scopes;
    		this.openAcceptPage(url, callback);						
    	},
    	
    	deleteAssociation: function(){
	 		db.setItem('accessToken','');
			db.setItem('refreshToken','');
			db.setItem('expiresOn','');
			
			this.accessToken = '';
			this.refreshToken = '';
			this.expiresOn = '';
    	},
    	
    	isAssociated: function(){
    		var accessToken = db.getItem('accessToken','');
    		var refreshToken = db.getItem('refreshToken','');
    		return( !(accessToken === '') &&  !(refreshToken === '') );
    	},
    	
    	opostJSON: function(url, data, success){
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Post to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expiré");
    				this.getRefreshedAccessToken();//this.opostJSON(url, data, success));
				}else{
					//TODO treat case no parameters given
					//data = data + '&access_token=' + this.accessToken;
					Tomahawk.asyncPostRequest(url, data, function (data) {
													success(JSON.parse(data.responseText));
											   }, {'Authorization': 'Bearer '+ this.accessToken});
				}
			}
    	},
    	
    	ogetJSON: function(url, success){
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Get to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expiré");
    				this.getRefreshedAccessToken();//this.ogetJSON(url, success));
				}else{
					//TODO treat case no parameters given
					//url = url + '&access_token=' + this.accessToken;
					Tomahawk.asyncRequest(url, function (data) {
													success(JSON.parse(data.responseText));
											   }, {'Authorization': 'Bearer '+ this.accessToken});
				}
			}
    	},
    	
    	//Private member
    	
       clientId: '440397511251.apps.googleusercontent.com',
       clientSecret: 'Y2ucuavLH6HN4CmlPGhdHuxu',
       oauthUrl:	'https://accounts.google.com/o/oauth2/auth',
       tokenUrl: 'https://accounts.google.com/o/oauth2/token',
       scopes: 'https://www.googleapis.com/auth/drive.readonly',
       redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
       accessToken: '',
       refreshToken: '',
       expiresOn: '',

        
		openAcceptPage: function(url, callback) {
			Tomahawk.log('Opening : ' + url);
			Tomahawk.requestWebView("acceptPage", url);
	
			//acceptPage.setWindowModality(2);
			//acceptPage.resize(acceptPage.height(), 800);

			acceptPage.show();
			acceptPage.titleChanged.connect(Tomahawk.resolver.instance.oauth, function(title){
												 					  		  this.onTitleChanged(title, callback);
																		  });
		},
    	
	    onTitleChanged: function(title, callback){
			Tomahawk.log("Title changed : \'" + title+"\'"); 
			
			//Success code=4/QcbxAjMwlkk56roXuLBM9nltk3ju 
			//Denied error=access_denied
			
			var result = title.split('=');
			
			if(result[0] === 'Success code'){
				Tomahawk.log("Accepted");
				var that = this;
				var params = 'grant_type=authorization_code'
						   + '&code=' + result[1] 
						   + '&client_id=' + this.clientId 
						   + '&client_secret='+ this.clientSecret 
						   + '&redirect_uri=' + this.redirectUri;
				Tomahawk.log("Sending post : "+ params);						   
				Tomahawk.asyncPostRequest(this.tokenUrl, params, function(data){
																		that.onAccessTokenReceived(data, callback);
																 	});
			}
		
			if(result[0] === 'Denied error'){ 
				Tomahawk.log("Refused");
				//close webpage
			}
		},
	
		onAccessTokenReceived: function(data, callback){	
			//parse response
		    var ret = JSON.parse(data.responseText);
		
			//TODO close webpage

			this.accessToken = ret.access_token;
			this.refreshToken = ret.refresh_token;
			this.expiresOn = Math.floor(Date.now()/1000) + ret.expires_in;

	 		db.setItem('accessToken',this.accessToken);
			db.setItem('refreshToken',this.refreshToken);
			db.setItem('expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				callback.call(Tomahawk.resolver.instance);
			}
		},
		
		onRefreshedTokenReceived: function(data, callback){	
			//parse response
		    var ret = JSON.parse(data.responseText);
			
			Tomahawk.log('Old access token : ' + this.accessToken);
			Tomahawk.log('New access token : ' + ret.access_token);

			this.accessToken = ret.access_token;
			this.expiresOn = Math.floor(Date.now()/1000) + ret.expires_in;

	 		db.setItem('accessToken',this.accessToken);
			db.setItem('expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				callback.call(Tomahawk.resolver.instance);
			}
		},
		
		tokenExpired: function(){
			return (Math.floor(Date.now()/1000) > this.expiresOn);
		},
		
		getRefreshedAccessToken: function(callback){
				Tomahawk.log("Refreshing token");
				var that = this;
				var params = 'grant_type=refresh_token'
							 + '&refresh_token=' + this.refreshToken
						     + '&client_id='     + this.clientId 
						     + '&client_secret=' + this.clientSecret;
										   
				Tomahawk.asyncPostRequest(this.tokenUrl, params, function(data){
															 that.onRefreshedTokenReceived(data, callback);
													     });
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

Tomahawk.resolver.instance = GoogleDriveResolver;
