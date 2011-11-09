/*
 * (c) 2011 Janez Troha (https://github.com/dz0ny)
 * (c) 2011 Leo Franchi <lfranchi@kde.org)
 */
var EightTracksResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: '8tracks Resolver',
        weight: 80,
        timeout: 5,
        api: "1442c0d04625c9d959527ae7d4a430afe9d2d1d9",
        token: null
    },
    init: function() {
        this.settings.token = window.localStorage["play_token"];
        if (!this.settings.token) {
            var that = this;
            this.get("http://8tracks.com/sets/new.json?api_key="+this.settings.api, true, function(data) {
                that.settings.token = data.play_token;
            });
        }
    },
    get: function (url, force, callback) {
      var cached = window.sessionStorage[url];
      if (!cached || force) {
          Tomahawk.asyncRequest(url, function(xhr){
              callback.call(window, JSON.parse(xhr.responseText));
              window.sessionStorage[url] = xhr.responseText;
           });
      } else {
          callback.call(window, JSON.parse(cached));
      }
    },
    resolve: function (qid, artist, album, title) {
        if(!this.settings.token) // either wait for init fetch to work, or give up
            return;

        var api = this.settings.api;
        var token = this.settings.token;
        var url = "http://8tracks.com/mixes.json?api_key="+api+"&per_page=1&sort=popular&q=";
            
        if(artist != "" )
            url += artist.replace(" ","+");
        
        var doGet = this.get;
        if (!window.localStorage[artist+album+title]) {
            doGet(url, true, function(data) {
                var res = data.mixes;
                if (res.length) {
                    doGet("http://8tracks.com/sets/"+token+"/play.json?api_key="+api+"&mix_id="+res[0].id, false, function(data) {
                        var track = data.set.track;
                        var response = { results: [] };
                        response.qid = qid;
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
                        window.localStorage[artist+album+track] = JSON.stringify(response.results)
                        Tomahawk.addTrackResults(response);
                    });
                }
            });
        } else {
            var response = { results: [] };
            response.qid = qid;
            response.results = JSON.parse(window.localStorage[artist+album+title]);
            return response;
        } 
    },
  
    search: function (qid, searchString) {
        var return1 = {
            qid: qid,
            results: new Array()
        };
        return return1;
    }
});

Tomahawk.resolver.instance = EightTracksResolver;