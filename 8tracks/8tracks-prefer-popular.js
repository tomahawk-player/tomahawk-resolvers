function getSettings()
{
    var response = new Object();
    response.name = "8tracks Resolver";
    response.weight = 20;
    response.timeout = 5;

    return response;
}

function resolve( qid, artist, album, track ){

  var get = function (url) {
      console.log("url:" + url)
      var httpRequest = new XMLHttpRequest();
      httpRequest.open("GET", url, false);
      httpRequest.send(null);
      return JSON.parse(httpRequest.responseText);
  }

  var response = {};
  response.qid = qid;
  response.results = [];

  var api="1442c0d04625c9d959527ae7d4a430afe9d2d1d9";
  var token = get("http://8tracks.com/sets/new.json?api_key="+api).play_token;
  var url = "http://8tracks.com/mixes.json?api_key="+api+"&per_page=1&sort=popular&q=";
      
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