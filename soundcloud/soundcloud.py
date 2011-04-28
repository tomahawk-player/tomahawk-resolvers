#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys, traceback
import os, getopt
from httplib import HTTP
import simplejson as json
from urlparse import urlparse
import urllib, urllib2
import socket
from xml.dom import minidom
from struct import unpack, pack


def soundex(name, len=4):
    """ soundex module conforming to Knuth's algorithm
        implementation 2000-12-24 by Gregory Jorgensen
        public domain
    """
    digits = '01230120022455012623010202'
    sndx = ''
    fc = ''

    for c in name.upper():
        if c.isalpha():
            if not fc: fc = c
            d = digits[ord(c)-ord('A')]
            if not sndx or (d != sndx[-1]):
                sndx += d

    sndx = fc + sndx[1:]

    sndx = sndx.replace('0','')

    return (sndx + (len * '0'))[:len]

def print_result(o):
	s = str(json.dumps(o))
	debugMsg("%s" % s)
	sys.stdout.write(pack('>L', len(s)))
	sys.stdout.write(s)
	sys.stdout.flush()

def debugMsg(message):
	pass

class TomahawkResolver:
	def results(self, query):
		return []
	
	def resolver_settings(self):
		return {}
		
	def settings(self):
		debugMsg("settings")
		settings =  {
			'_msgtype':'settings', 
			'name':'Generic Python Resolver', 
			'targettime':10000, 
			'weight':80
		}
		settings.update(self.resolver_settings())
		debugMsg(settings)
		return settings
		
	def resolve(self, query):
		return {'_msgtype':'results', 'qid': query['qid'], 'results':self.results(query)}
	
	@classmethod
	def start_static(cls):
		return cls().start()
		
	def start(self):
		print_result(self.settings())
		
		while 1:
			length = sys.stdin.read(4)
		
			if not length:
				break;

			length = unpack('!L', length)[0]
			if not length:
				break
			if length > 4096 or length < 0:
				break
			if length > 0:
				msg = sys.stdin.read(length)
				try:
					request = json.loads(msg)
					results = self.resolve(request)
					print_result(results)
				except:
					traceback.print_exc(file=sys.stderr)
					pass

class SoundCloudResolver(TomahawkResolver):
        def resolver_settings(self):
            return {'name':"SoundCloud Resolver", 'targettime':10000, 'weight':80}

        def results(self, query):
            param_string = ''
            params = {}
            params['filter'] = "streamable"
            params['q'] = '"'+query['artist']+' '+query['track']+'"';
            param_string = urllib.urlencode(params)

            url = 'http://api.soundcloud.com/tracks.json?client_id=TiNg2DRYhBnp01DA3zNag&'+param_string

            c=urllib2.urlopen(url)
            contents = c.read()
            try:
                data = json.loads(contents)
            except ValueError:
                return []

            if len(data) < 1:
                return []
            
            i =0
            song = {};
            song['artist'] = query['artist']
            song['track'] = data[i]['title']
	    #song['artist'] = data[i]['title'].split(" - ")[0]
	    #song['track'] = data[i]['title'].split(" - ")[1]
	    song['source'] = 'SoundCloud'
            song['score'] = 1.00;
            song['url'] = data[i]['stream_url']+".json?client_id=TiNg2DRYhBnp01DA3zNag"
            song['duration']= data[i]['duration']/1000
            song['mimetype'] = 'audio/mpeg'
            song['bitrate'] = 128;
            song['year'] = data[i]['release_year']
            return [song];
        def test(self):
            print self.results({'artist':"Bon Jovi", 'track':"You Give Love A Bad Name"})
                
if __name__ == "__main__":
    try:
        opts, args = getopt.getopt(sys.argv[1:], "t", ["test"])
        for opt, arg in opts:
            if opt in ("-t", "--test"):
                r = SoundCloudResolver()
                r.test()
                sys.exit()
    except getopt.GetoptError:
        sys.exit(2)

    SoundCloudResolver.start_static()