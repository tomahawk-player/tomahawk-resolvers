/* zaycevnet.info resolver for Tomahawk.
 *
 * Written in 2015 by Anton Romanov
 * Licensed under the Eiffel Forum License 2.
 *
 */

function strtr(str, from, to) {
  //  discuss at: http://phpjs.org/functions/strtr/
  // original by: Brett Zamir (http://brett-zamir.me)
  //    input by: uestla
  //    input by: Alan C
  //    input by: Taras Bogach
  //    input by: jpfle
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Brett Zamir (http://brett-zamir.me)
  // bugfixed by: Brett Zamir (http://brett-zamir.me)
  //  depends on: krsort
  //  depends on: ini_set
  //   example 1: $trans = {'hello' : 'hi', 'hi' : 'hello'};
  //   example 1: strtr('hi all, I said hello', $trans)
  //   returns 1: 'hello all, I said hi'
  //   example 2: strtr('äaabaåccasdeöoo', 'äåö','aao');
  //   returns 2: 'aaabaaccasdeooo'
  //   example 3: strtr('ääääääää', 'ä', 'a');
  //   returns 3: 'aaaaaaaa'
  //   example 4: strtr('http', 'pthxyz','xyzpth');
  //   returns 4: 'zyyx'
  //   example 5: strtr('zyyx', 'pthxyz','xyzpth');
  //   returns 5: 'http'
  //   example 6: strtr('aa', {'a':1,'aa':2});
  //   returns 6: '2'

  var fr = '',
    i = 0,
    j = 0,
    lenStr = 0,
    lenFrom = 0,
    tmpStrictForIn = false,
    fromTypeStr = '',
    toTypeStr = '',
    istr = '';
  var tmpFrom = [];
  var tmpTo = [];
  var ret = '';
  var match = false;

  // Received replace_pairs?
  // Convert to normal from->to chars
  if (typeof from === 'object') {
    // Not thread-safe; temporarily set to true
    tmpStrictForIn = this.ini_set('phpjs.strictForIn', false);
    from = this.krsort(from);
    this.ini_set('phpjs.strictForIn', tmpStrictForIn);

    for (fr in from) {
      if (from.hasOwnProperty(fr)) {
        tmpFrom.push(fr);
        tmpTo.push(from[fr]);
      }
    }

    from = tmpFrom;
    to = tmpTo;
  }

  // Walk through subject and replace chars when needed
  lenStr = str.length;
  lenFrom = from.length;
  fromTypeStr = typeof from === 'string';
  toTypeStr = typeof to === 'string';

  for (i = 0; i < lenStr; i++) {
    match = false;
    if (fromTypeStr) {
      istr = str.charAt(i);
      for (j = 0; j < lenFrom; j++) {
        if (istr == from.charAt(j)) {
          match = true;
          break;
        }
      }
    } else {
      for (j = 0; j < lenFrom; j++) {
        if (str.substr(i, from[j].length) == from[j]) {
          match = true;
          // Fast forward
          i = (i + from[j].length) - 1;
          break;
        }
      }
    }
    if (match) {
      ret += toTypeStr ? to.charAt(j) : to[j];
    } else {
      ret += str.charAt(i);
    }
  }

  return ret;
};

var ZaycevResolver = Tomahawk.extend( Tomahawk.Resolver.Promise, {
    apiVersion: 0.9,

    settings: {
        cacheTime: 300,
        name: 'zaycevnet',
        weight: 76,
        icon: '../images/icon.png',
        timeout: 8
    },

    decodeSongID: function(song_id) {
        song_id = decodeURIComponent(song_id).replace(/[\-_]/gi, '');
        var alphabet = song_id.substr(0, 16);
        song_id = song_id.substr(16);
        song_id = strtr(song_id, alphabet, '0123456789abcdef');
        //I'm sure there should be less awkward way to get the raw final string
        //with CryptoJS
        song_id = CryptoJS.RC4.encrypt(CryptoJS.enc.Hex.parse(song_id), CryptoJS.enc.Latin1.parse(this.keyd));
        song_id = CryptoJS.enc.Base64.parse(song_id.toString()).toString(CryptoJS.enc.Latin1);
        return song_id;
    },

    _convertTrack: function (entry) {
        return {
            artist:     Tomahawk.htmldecode(entry.artist.name),
            track:      Tomahawk.htmldecode(entry.name),
            title:      Tomahawk.htmldecode(entry.name),
            duration:   entry.length,
            url:        'zaycev://' + entry.uid,
            checked:    true,
            type:       "track",
        };
    },

    init: function() {
        var that = this;
        Tomahawk.addCustomUrlHandler( 'zaycev', 'getStreamUrl', true );

        return Tomahawk.get("http://zaycevnet.info/").then(function (response){
            var keyRe = /var\ +keyd\ *=[^"]+"([^"]+)/gm;
            var hostRe = /[\.\ ]api_host\ *=[^"]+"([^"]+)/gm;
            that.keyd = keyRe.exec(response)[1];
            that.api_location = 'http://' + hostRe.exec(response)[1] + '/';
        });
    },

    search: function (query) {
        var that = this;

        return Tomahawk.get("http://zaycevnet.info/term/" + query).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            return response.map(that._convertTrack, that);
        });
    },

    resolve: function (artist, album, title) {
        var query = [ artist, title ].join(' - ');
        return this.search(query);
    },

    getStreamUrl: function(qid, url) {
        var that = this;
        var id = this.decodeSongID(url.split('://')[1]);
        Tomahawk.get(this.api_location + 'audio.getlinks/', {
            data: {
                proxy: '4',
                id: id,
                format: 'jsongz',
                hash: id
            }
        }).then(function (response){
            if (typeof response == 'string' || response instanceof String)
                response = JSON.parse(response);
            if(response.status == 'ok')
                Tomahawk.reportStreamUrl(qid, response.result[0].url);
            else
                Tomahawk.reportStreanUrl(qid, '');
        });
    }
});

Tomahawk.resolver.instance = ZaycevResolver;

