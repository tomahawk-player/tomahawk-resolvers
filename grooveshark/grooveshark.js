function getSettings()
{
    var response = new Object();
    response.name = "Grooveshark Resolver";
    response.weight = 85;
    response.timeout = 5;

    return response;
}

// : Start a session using startSession and then use authenticate to authenticate your user.
// Verify that they are an Anywhere user and then proceed. Be sure to keep the sessionID
//    generated from startSession and send it along with all stream requests.
// 1. get session id
// 2. get country id
// 3. search for song getSongSearchResultsEx to get songId
// 4. Request StreamKey
// 5. Make a request to getStreamKeyStreamServer or getSubscriberStreamKey with your sessionID, songID and country.
//     You can use lowBitrate=1 to get a low bitrate file, otherwise send lowBitrate=0.

function getSessionId() {
    var sessionId = window.localStorage['sessionId'];
    if (sessionId) {
        return sessionId;
    }

    var sessionUrl = "http://api.grooveshark.com/ws3.php"
}

function resolve( qid, artist, album, track ){

  var url = "http://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q=";

  if(artist !== "" ){
    url += encodeURIComponent(artist) + "+";
  }
  if(track !== "" ){
    url += encodeURIComponent(track);
  }
  url = url.replace(/\%20/g,'\+');
  var myJsonObject = {};
  var httpRequest = new XMLHttpRequest();
  httpRequest.open("GET", url, false);
  httpRequest.onreadystatechange = function(){
    if (httpRequest.readyState == 4 && httpRequest.status == 200){
	myJsonObject = JSON.parse(httpRequest.responseText);
    }
  }
  httpRequest.send(null);

  var results = new Array();

  for (i=0;i<myJsonObject.length;i++){
    var result = new Object();
    result.artist = artist;
    result.track = myJsonObject[i].title;
    result.year = myJsonObject[i].release_year;
    result.source = "SoundCloud";
    result.url = myJsonObject[i].stream_url+".json?client_id=TiNg2DRYhBnp01DA3zNag";
    result.mimetype = "audio/mpeg";
    result.bitrate = 128;
    result.duration = myJsonObject[i].duration/1000;
    result.score = 1.00;
    results.push(result);
  }

  var response = new Object();
  response.qid = qid;
  response.results = results;

  return response;

}