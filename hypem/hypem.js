function getSettings()
{
    var response = new Object();
    response.name = "Hypem Resolver";
    response.weight = 90;
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
        //httpRequest.setRequestHeader('User-Agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0.742.91 Safari/534.30');
        //httpRequest.setRequestHeader('Host','hypem.com');
        //httpRequest.setRequestHeader('Referer','http://hypem.com/');
        //httpRequest.setRequestHeader('X-Prototype-Version','1.7');
        //httpRequest.setRequestHeader('X-Requested-With','XMLHttpRequest');
        httpRequest.send(null);
        cached =window.sessionStorage[url] = httpRequest.responseText;
      }
      return cached;
  }

  var response = {};
  response.qid = qid;
  response.results = [];

  var api = "http://hypem.com/search/";
  var search = "";    
  if(artist != "" ){
    search += artist
  }
  if(track != "" ){
    search += " "+track
  } 
     
  var data = get(api+encodeURI(search)+"?ax=1&ts=1307652360");
  var tracks = /trackList\[document\.location\.href\]\.push\(\{([\W\w]+?)\}\)/ig;
  var trackString = tracks.exec(data);
  if (trackString) {
    trackString = "{"+trackString[1].replace(/\s(\w+):/ig,'"$1":').replace(/'/ig,'"').replace(/\s/g,"")+"}"
    //console.log(trackString)
    var track = JSON.parse(trackString);
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!http://hypem.com/serve/play/" + track.id +"/"+ track.key+".mp3")
    response.results.push({
        artist   : track.artist
      , track    : track.song 
      , url      : "http://hypem.com/serve/play/" + track.id +"/"+ track.key+".mp3"
      , duration : track.time 
      , source   : "Hypem.com" 
      , score    : 1.00
    });
  };

  return response;
    
}