#!/usr/bin/python2.7
# -*- coding: utf-8 -*-
#
# Copyright 2012 David Laban <alsuren@gmail.com>
# Based on daap-resolver
# Created by Christophe "Tito" De Wolf <tito@webtito.be> twitter.com/tito1337
# Licensed under GPLv3 (http://www.gnu.org/licenses/gpl)
######################################################################


from jol_search import (get_structured_listing, get_name_artist_map, transpose,
        normalize_name_tag, parse_artist_tag)

import os
import sys
from struct import unpack, pack
import json

import logging

logger = logging.getLogger('jazz-on-line-resolver')
	
def print_json(o):
    s = json.dumps(o)
    logger.debug("responding %s", s)
    if LINE_BASED_PROCESSING:
        sys.stdout.write(s + '\n')
    else:
	sys.stdout.write(pack('!L', len(s)))
        sys.stdout.write(s)
    sys.stdout.flush()


def return_exact_results(request, results, callback):
    formatted_results = []
    for song in results:
    	result = {
		"artist": song["artist"],
		"track": song["name"],
		"score": 1,
		"url": song["link"],
		"mimetime": "audio/mpeg",
		"source": "jazz-on-line.com",
	    }
	if 1800 < song.get("year", 0) < 2100:
            result["year"] = song["year"]
        formatted_results.append(result)

    response = {
            'qid': request['qid'],
            'results': formatted_results,
            '_msgtype': 'results'
	}
    callback(response)

def search_for_track(request, callback):
    song_name = normalize_name_tag(request['track'])
    songs_by_artist = songs_by_name_artist.get(song_name, {})
    exact_results = []
    for artist in parse_artist_tag(request["artist"]):
        if artist in songs_by_artist:
            songs = songs_by_artist[artist]
            for song in songs:
                exact_results.append(song)

    if exact_results:
    	return_exact_results(request, exact_results, callback)
    else:
        logger.debug("%s produced no results", request)
	

if __name__ == "__main__":
    try:
	if "--line-based" in sys.argv:
		sys.argv.remove("--line-based")
		LINE_BASED_PROCESSING = True
                logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
	else:
		LINE_BASED_PROCESSING = False

        THIS_DIR = os.path.dirname(__file__)
        if THIS_DIR:
            THIS_DIR = os.path.abspath(THIS_DIR)
        else:
            THIS_DIR = os.path.abspath('.')

	logger.info("Started in %s", THIS_DIR)

	structured_listing = get_structured_listing(THIS_DIR + "/listing.txt")
	songs_by_artist_name = get_name_artist_map(structured_listing)
	songs_by_name_artist = transpose(songs_by_artist_name)

	logger.info("Advertising settings.")
	settings = {
                "_msgtype": "settings",
                "name": "jazz-on-line resolver",
		"targettime": 100, # ms
		"weight": 80
		}
	print_json(settings)

	while True:
            if LINE_BASED_PROCESSING:
                msg = sys.stdin.readline()
                if not msg.strip():
                    exit(0)
                request = json.loads(msg)
            else:
                logger.debug("waiting for message length")
                big_endian_length = sys.stdin.read(4)

                if len(big_endian_length) < 4:
                    logger.debug("No length given (%r==EOF?). Exiting.", 
                            big_endian_length)
                    exit(0)
                length = unpack("!L", big_endian_length)[0]
                if not length or not 4096 > length > 0:
                    logger.warn("invalid length: %s", length)
                    break
                logger.debug("waiting for %s more chars", length)
                msg = sys.stdin.read(length)
                request = json.loads(msg)
        
            if '_msgtype' not in request:
                logger.warn("malformed request (no _msgtype): %s",
                    request)
            elif request['_msgtype'] == 'rq': # Search
                if 'fulltext' in request:
                    logger.debug("not handling searches for now")
                    continue
                else:
                    logger.debug("searching for for %s", request)
                    search_for_track(request, print_json)
                    continue
            elif request['_msgtype'] == 'config':
                logger.debug("ignoring config message: %s", request)
            elif request['_msgtype'] == 'quit':
                logger.info("Asked to Quit. Exiting.")
                exit(0)
            else:
                logger.warn("Don't understand %s", request)

    except Exception:
        logger.exception("something went wrong")
        raise
