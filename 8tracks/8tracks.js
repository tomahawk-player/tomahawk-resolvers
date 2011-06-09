function getSettings()
{
    var response = new Object();
    response.name = "8tracks Resolver";
    response.weight = 50;
    response.timeout = 5;

    return response;
}

function resolve( qid, artist, album, track ){

  var cache = window.sessionStorage;

  var get = function (url) {
      var cached = window.sessionStorage[url];
      if (!cached) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.open("GET", url, false);
        httpRequest.send(null);
        cached =window.sessionStorage[url] = httpRequest.responseText;
      }
      return JSON.parse(cached);
  }

  var response = {};
  response.qid = qid;
  response.results = [];

  var api="1442c0d04625c9d959527ae7d4a430afe9d2d1d9";
  var token = window.sessionStorage["play_token"];
  if (!token) {
    token = window.sessionStorage["play_token"] = get("http://8tracks.com/sets/new.json?api_key="+api).play_token
  }
  var token = get("http://8tracks.com/sets/new.json?api_key="+api).play_token;
  var url = "http://8tracks.com/mixes.json?api_key="+api+"&per_page=1&sort=random&q=";
      
  if(artist != "" )
      url += artist.replace(" ","+");
  
  var res = get(url).mixes;
  if (res.length) {
    var mix = get("http://8tracks.com/sets/"+token+"/play.json?api_key="+api+"&mix_id="+res[0].id)
    var track = mix.set.track;
    response.results.push({
        artist   : track.performer
      , track    : track.name 
      , album    : track.release_name 
      , year     : track.year 
      , url      : track.url 
      , duration : track.play_duration 
      , source   : "8tracks" 
      , score    : 1.00
    });
  };
  return response;
    
}