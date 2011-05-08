function getSettings(){
    var response = new Object();
    response.name = "Last.fm Resolver";
    response.weight = 87;
    response.timeout = 5;

    return response;
}

function resolve( qid, artist, album, track ){
  
  var settings = getSettings();
  
  if(artist !== "" ){
    artist = encodeURIComponent(artist);
  }
  if(track !== "" ){
    track = encodeURIComponent(track);
  }
  var apiQuery = "http://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=3ded6e3f4bfc780abecea04808abdd70&format=json&artist="+artist+"&track="+track;
  apiQuery = apiQuery.replace(/\%20/g,'\+');
  
  var myJsonObject = {};
  var httpRequest = new XMLHttpRequest();
  httpRequest.open('GET', apiQuery, false);
  httpRequest.onreadystatechange = function(){
    if (httpRequest.readyState == 4 && httpRequest.status == 200){
	myJsonObject = JSON.parse(httpRequest.responseText);
    }
  }
  httpRequest.send(null);
  
  var results = new Array();
  if (myJsonObject.track && myJsonObject.track.freedownload){
    var result = new Object();
    result.artist = myJsonObject.track.artist.name;
    result.track = myJsonObject.track.name;
    result.year = myJsonObject.track.year;
    result.source = settings.name;
    result.url = myJsonObject.track.freedownload;
    result.mimetype = "audio/mpeg";
    result.bitrate = 128;
    result.duration = myJsonObject.track.duration/1000;
    result.score = 1.00;
    result.album = myJsonObject.track.album.title;
    results.push(result);
  }
  var response = new Object();
  response.qid = qid;
  response.results = results;
  return response;
}