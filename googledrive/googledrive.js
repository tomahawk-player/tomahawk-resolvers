var GoogleDriveResolver = Tomahawk.extend(TomahawkResolver, {
	uid: '',
	cursor: '',
	maxResults: '15000',
	 
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
       var that = this;
       this.oauth.associate(function(){
								that.updateDatabase();
							});
    },
    
    deleteClicked: function () {
       Tomahawk.log("Delete was clicked");
       
       this.cursor = '';
	   dbLocal.setItem('cursor','');
	   
       this.oauth.deleteAssociation();
       
    },
    
    queryFailure: function(data) {
    	Tomahawk.log("Request Failed : " + data.text);
    },
    
    init: function () {
        Tomahawk.log("Beginnning INIT of Google Drive resovler");
		//dbLocal.setItem("expiresOn","1");
        Tomahawk.addLocalJSFile("musicManager.js");
        
        this.cursor = dbLocal.getItem('cursor','');
        
        this.oauth.init();
        
        musicManager.initDatabase() ;
        this.googleDriveMusicManagerTests() ; 
        
        Tomahawk.log(typeof this.expiresOn );
        Tomahawk.log((Math.floor(Date.now()/1000) ).toString());

		//TODO updateDatabase every 30 min (and handle if a user asked for a DB refresh before)
		//TODO update only if asscociated to an account
		
  		this.updateDatabase();
    },
        
    updateDatabase: function(){
		var that = this;
    	Tomahawk.log("Sending Delta Query : ");
    	var url = 'https://www.googleapis.com/drive/v2/changes?'
    			  +'maxResults=' + this.maxResults
    			  +'&pageToken=1'; 
		this.oauth.ogetJSON(url, function(){that.deltaCallback;});
    },
    
    deltaCallback: function(response){
    	//TODO set cursor in DB
    	Tomahawk.log("Delta returned!");
    	Tomahawk.log("selfLink : " + response.selfLink);
    	Tomahawk.log("nextPageToken : " + response.nextPageToken);
    	//Tomahawk.log(DumpObjectIndented(response.items));
    	
    	for( var i = 0; i < response.items.length; i++){
			var item = response.items[i];
			//Tomahawk.log(DumpObjectIndented(item));
			//Tomahawk.log(item['file']['mimeType']);
			//Tomahawk.log(this.isMimeTypeSupported);
			for(var p in this){
				Tomahawk.log(p + " : "+ this[p]);
			}
			if(this.isMimeTypeSupported(item['file']['mimeType'])){
				if(item.deleted === 'true'){
					Tomahawk.log("Deleting : " + item['fileId']);
					//dbSQL.deleteTrack(item.file.id);
				}else{
					//Get ID3 Tag
					Tomahawk.log("Get ID3Tag from : " + item['file']['originalFilename']);
					//var that = this;
					//Tomahawk.getID3Tag(this.oauth.createOauthUrl(item['file']['downloadUrl']), function(tags){
																								//that.onID3TagCallback(item['fileId'], tags);
																							//});
				}
			}
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

    },
	
	googleDriveMusicManagerTests: function() {	 
		 //~ musicManagerTester.flushDatabaseTest() ;
		 //~ musicManagerTester.init() ;
		 //~ musicManagerTester.addTrackTest() ;
		 //~ musicManagerTester.deleteTrackTest() ;
		 //~ musicManagerTester.resolveTest() ;
		 //~ musicManagerTester.allArtistsQueryTest() ;
		 //~ musicManagerTester.tracksQueryTest() ;
		 //~ musicManagerTester.albumsQueryTest() ;
		 //~ musicManagerTester.populateDatabase(9) ;
		 //~ musicManagerTester.showDatabase() ;
	},
    
    getID3Tag: function(fileUrl, callback)
    {
		
	},
    
    onID3TagCallback: function(fileId, tags)
    {
		//Add track to database
		//var url = 'googledrive://' + fileId;
		//dbSql.addTrack
	},
    
    isMimeTypeSupported: function(mimeType)
    {
		Tomahawk.log("Checking : "+ mimeType);
		var mimes =  [ "audio/mpeg" , "application/ogg" , "application/ogg" , "audio/x-musepack" , "audio/x-ms-wma" , "audio/mp4" , "audio/mp4" , "audio/mp4" , "audio/flac" , "audio/aiff" ,  "audio/aiff" , "audio/x-wavpack" ];
		return (mimes.contains(mimeType));
	},
    
    oauth: {
    
    	init: function(){
    		this.accessToken = dbLocal.getItem('accessToken','');
    		this.refreshToken = dbLocal.getItem('refreshToken','');
    		this.expiresOn = dbLocal.getItem('expiresOn','');
    	},
    
    	//associate a new User
    	//If the association is succesfull the previous token is discarded
    	associate: function(callback){
    		var url = this.oauthUrl + '?response_type=code&client_id=' + this.clientId + '&redirect_uri=' + this.redirectUri + '&scope=' + this.scopes;
    		this.openAcceptPage(url, callback);						
    	},
    	
    	deleteAssociation: function(){
	 		dbLocal.setItem('accessToken','');
			dbLocal.setItem('refreshToken','');
			dbLocal.setItem('expiresOn','');
			
			this.accessToken = '';
			this.refreshToken = '';
			this.expiresOn = '';
    	},
    	
    	isAssociated: function(){
    		var accessToken = dbLocal.getItem('accessToken','');
    		var refreshToken = dbLocal.getItem('refreshToken','');
    		return( !(accessToken === '') &&  !(refreshToken === '') );
    	},
    	
    	opostJSON: function(url, data, success){
			var that = this;
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Post to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expired");
    				this.getRefreshedAccessToken(function (){that.opostJSON(url, data, success);});
				}else{
					//TODO treat case no parameters given
					Tomahawk.asyncPostRequest(url, data, function (data) {
													success(JSON.parse(data.responseText));
											   }, {'Authorization': 'Bearer '+ this.accessToken});
				}
			}
    	},
    	
    	ogetJSON: function(url, success){
			var that = this;
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Get to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expired");
    				this.getRefreshedAccessToken(function (){that.ogetJSON(url, success);});
				}else{
					//TODO treat case no parameters given
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
			
			var result = title.split('=');
			
			if(result[0] === 'Success code'){
				Tomahawk.log("Accepted");
				var that = this;
				var params = 'grant_type=authorization_code'
						   + '&code=' + result[1] 
						   + '&client_id=' + this.clientId 
						   + '&client_secret='+ this.clientSecret 
						   + '&redirect_uri=' + this.redirectUri;

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

	 		dbLocal.setItem('accessToken',this.accessToken);
			dbLocal.setItem('refreshToken',this.refreshToken);
			dbLocal.setItem('expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				callback.call(Tomahawk.resolver.instance);
				//callback();
			}
		},
		
		onRefreshedTokenReceived: function(data, callback){	
			//parse response
		    var ret = JSON.parse(data.responseText);
			
			Tomahawk.log('Old access token : ' + this.accessToken);
			Tomahawk.log('New access token : ' + ret.access_token);

			this.accessToken = ret.access_token;
			this.expiresOn = Math.floor(Date.now()/1000) + ret.expires_in;

	 		dbLocal.setItem('accessToken',this.accessToken);
			dbLocal.setItem('expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				Tomahawk.log("Calling...");
				callback.call(Tomahawk.resolver.instance);
				//callback();
			}
		},
		
		tokenExpired: function(){
			return (Math.floor(Date.now()/1000) > this.expiresOn);
		},
		
		getRefreshedAccessToken: function(callback){
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

var dbLocal = {
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

function DumpObjectIndented(obj, indent)
{
  var result = "";
  if (indent == null) indent = "";

  for (var property in obj)
  {
    var value = obj[property];
    if (typeof value == 'string')
      value = "'" + value + "'";
    else if (typeof value == 'object')
    {
      if (value instanceof Array)
      {
        // Just let JS convert the Array to a string!
        value = "[ " + value + " ]";
      }
      else
      {
        // Recursive dump
        // (replace "  " by "\t" or something else if you prefer)
        var od = DumpObjectIndented(value, indent + "  ");
        // If you like { on the same line as the key
        //value = "{\n" + od + "\n" + indent + "}";
        // If you prefer { and } to be aligned
        value = "\n" + indent + "{\n" + od + "\n" + indent + "}";
      }
    }
    result += indent + "'" + property + "' : " + value + ",\n";
  }
  return result.replace(/,\n$/, "");
}
