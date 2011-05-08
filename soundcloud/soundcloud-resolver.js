function getSettings()
{
    var response = new Object();
    response.name = "SoundCloud Resolver";
    response.weight = 84;
    response.timeout = 10;

    return response;
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