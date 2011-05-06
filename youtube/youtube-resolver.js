function getSettings()
{
    var settings = new Object();
    settings.name = "Youtube Resolver";
    settings.weight = 80;
    settings.timeout = 10;
    settings.maxResults = 5;

    return settings;
}

function resolve( qid, artist, album, track ){
  
  var properties = getSettings();
  
  if(artist !== "" )
    query = encodeURIComponent(artist) + "+";

  if(track !== "" )
    query += encodeURIComponent(track);
  
  var apiQuery = "http://gdata.youtube.com/feeds/api/videos?q="+ query + "&v=2&alt=jsonc&max-results=" + properties.maxResults;
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
  
  var syncRequest = function(videoUrl) {
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.open('GET', videoUrl, false);
    xmlHttpRequest.send(null);
    return xmlHttpRequest.responseText;
  }
  
  var decodeurl = function(url) { return unescape(url); /*.replace(/%2C/g, ",").replace(/%20/g, " ").replace(/%3A/g, ":");*/ };

  
  var parseVideoUrlFromYtPage = function(html) {
    var magic = "fmt_stream_map=";
    var magicFmt = "18";
    var magicLimit = "%7C";
    var pos = html.indexOf(magic) + magic.length;
    html = html.slice(pos);
    html = html.slice(html.indexOf(magicFmt + magicLimit) + (magic+magicLimit).length);
    finalUrl = html.slice(0, html.indexOf(magicLimit) );
    return "http://" + decodeurl( finalUrl ) + "&format=xml";
    }
  
  
  var results = new Array();
  if (myJsonObject.data.totalItems > 0){
    for (i=0;i<myJsonObject.data.totalItems && i<properties.maxResults;i++){
      var result = new Object();
      result.artist = artist;
      result.track = myJsonObject.data.items[i].title;
      //result.year = ;
      result.source = properties.name;
      var urlContents = syncRequest(myJsonObject.data.items[i].player.default);
      result.url = parseVideoUrlFromYtPage(urlContents);
      result.mimetype = "video/h264";
      //result.bitrate = 128;
      result.duration = myJsonObject.data.items[i].duration;
      result.score = 1.00;
      results.push(result);
    }
  }
  var response = new Object();
  response.qid = qid;
  response.results = results;
  return response;
}