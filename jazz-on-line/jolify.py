import os
import json
import re
from xml.sax.saxutils import escape

import logging

logger = logging.getLogger('jazz-on-line search library')

LISTING_FORMAT = ["link", "artist", "name",
        "label", "number", "matrix", "year", "artists"]

bracketmatcher = re.compile(r" *\(.*\)")
def delete_brackets(string):
    newstring = bracketmatcher.sub("", string)
    return newstring

quotesmatcher = re.compile(r""" *['"].*['"]""")
def delete_quotes(string):
    return quotesmatcher.sub("", string)

def normalize(string_):
    string = delete_brackets(string_)
    string = string.lower().strip()
    return string
        

def normalize_name_tag(string):
    name_tag = normalize(string).replace(':', '')
    for sep in [" - ", " feat. "]:
        name, sep, rest = name_tag.partition(sep)
	if rest:
	    name_tag = name
	    break
    return name_tag.replace('-', ' ').replace('ing', 'in').replace("'", "")

def parse_artist_tag(string):
    artists = []
    artist_tag = normalize(string)
    for sep in [" w ", " et ", " and ", " & ", "'s ", " orch",
		" sextet", " quintet", " quartet", " trio"]:
        artist, sep, rest = artist_tag.partition(sep)
        if sep:
            artists.append(artist)
            break
    else:
        artists.append(artist_tag)

    for sep in [" feat. ", " and ", " w "]:
        artist, sep, feature = artist_tag.partition(sep)
        if feature and not feature.startswith("his ") \
		and not feature.startswith("her "):
            artists.append(feature)

    mistakes = {"rgythm": "rhythm", "the ": ""}
    for mistake, replacement in mistakes.items():
        if mistake in artist_tag:
            artists.extend(parse_artist_tag(artist_tag.replace(mistake, replacement)))

    return artists

def get_structured_listing(listings_filename):
	listings = open(listings_filename)
	listings.next()
	structured_listing = []
	previous_line = ""
	for lineno, line in enumerate(listings):
	    splitline = line.split("\t")
	    if len(splitline) < len(LISTING_FORMAT):
		logger.error("problem on line %s", lineno)
		logger.error("%s", repr(previous_line))
		logger.error("%s", repr(line))
		continue
	    song = dict(zip(LISTING_FORMAT, splitline))
	    structured_listing.append(song)
	    previous_line = line

	structured_listing.sort(key=lambda x: x["link"].rpartition('/')[-1])
	return structured_listing

def get_artist_list(song):
    artists = parse_artist_tag(song["artist"])
    artists_tag = normalize(song["artists"])
    artists_tag = artists_tag.replace(" and ", ", ")
    artists_tag = artists_tag.replace(" or ", ", ")
    artists_tag = re.sub("[^,]* by ", "", artists_tag)
    split_artists_tag = artists_tag.split(", ")
    split_artists_tag = [delete_quotes(name)
            for name in split_artists_tag if " " in name]
    if len(split_artists_tag) > 1:
            artists = artists + split_artists_tag

    return artists


def get_name_artist_map(structured_listing):
    songs_by_artist_name = {} # {artist: {name: [songdetails]}}
    for song in structured_listing:
        song_name = normalize_name_tag(song["name"])
        artists = get_artist_list(song)

        for artist in set(artists):
            songs_by_name = songs_by_artist_name.setdefault(artist, {})
            songs = songs_by_name.setdefault(song_name, [])
            songs.append(song)
    return songs_by_artist_name

def transpose(songs_by_artist_name):
    songs_by_name_artist = {} # {name: {artist: [songdetails]}}
    for artist, songs_by_name in songs_by_artist_name.iteritems():
        for song_name, songs in songs_by_name.iteritems():
            by_artist = songs_by_name_artist.setdefault(song_name, {})
            songs = by_artist.setdefault(artist, songs)
    return songs_by_name_artist

def spotify_artist_list(spotify_song):
	for artist in spotify_song["artists"]:
		# print artist
		for possibility in parse_artist_tag(artist):
			# print possibility
			yield(possibility)

def add_jol_links(playlist):
    for spotify_song in playlist["songs"]:
        if not spotify_song:
            continue
        song_name = normalize_name_tag(spotify_song["name"])
        if song_name not in songs_by_name_artist:
            # print spotify_song
            continue
            
        songs_by_artist = songs_by_name_artist[song_name]
        for artist in spotify_artist_list(spotify_song):
            if artist in songs_by_artist:
                songs = songs_by_artist[artist]
                jol_links = spotify_song.setdefault("jol_links", [])
                for song in songs:
                    jol_links.append(song["link"])
        if "jol_links" not in spotify_song:
            fallbacks = {}
	    for artist, songs in songs_by_artist.items():
	        links = []
	        for song in songs:
	            links.append(song["link"])
	        fallbacks[artist] = links
	    if fallbacks:
                spotify_song["jol_fallbacks"] = fallbacks
	    else:
	        # print spotify_song
	        continue

def make_local_files_map(directory_root):
	local_files_map = {}
	def add_to_map(local_files_map, dirname, fnames):
		dirname = dirname.replace("\\", "/")
		for name in fnames[:]:
			name = name.lower()
			if name.endswith("mp3"):
				local_files_map[name] = dirname
			# elif '.' in name:
				# print dirname, name

	os.path.walk(directory_root, add_to_map, local_files_map)
	return local_files_map


def pick_best_link_or_download(link_list, local_files_map):
	fallback_links = []
	for link in link_list:
		remote_location, _slash, filename = link.rpartition("/")
		location = local_files_map.get(filename.lower(), None)
		if location is not None:
			return "/".join((location, filename))
		else:
			fallback_links.append(link)

	for link in fallback_links:
		remote_location, _slash, filename = link.rpartition("/")
		# os.system(r'"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" %s' % link)
		local_files_map[filename.lower()] = "DOWNLOADING"
		# raw_input("hit enter when you get %s" % link)
		return "DOWNLOADING/" + filename
	return None

def pick_best_link(link_list, local_files_map):
	for link in link_list:
		remote_location, _slash, filename = link.rpartition("/")
		location = local_files_map.get(filename.lower(), None)
		if location is not None:
			return "/".join((location, filename))
	return None

def get_local_song_location(spotify_song, local_files_map):
	fallback_links = []
	location = pick_best_link(spotify_song.get("jol_links", []), local_files_map)
	if location is not None:
		return location

	jol_fallbacks = spotify_song.get("jol_fallbacks", {})

	if not jol_fallbacks:
		return "#not found"

	for artist, links in jol_fallbacks.items():
		location = pick_best_link(links, local_files_map)
		if location is not None:
			return location
	
	return "#not found"

	options = sorted(jol_fallbacks.keys())

	# Only pick the shortest name.
	for option_i in options[:]:
	    if option_i in u''.join(spotify_song["artists"]).lower():
	        options = [option_i]
		break
	    for option_j in options[:]:
	    	if option_i in option_j and option_j != option_i:
		     options.remove(option_j)

	if len(options) == 1:
		artist = options[0]
	else:
		return "#didn't like any of %s" % options

	link = pick_best_link_or_download(jol_fallbacks[artist], local_files_map)
	if link is None:
		link = "#Sorry. couldn't find %s's version after all" % artis
	return link


def get_m3u_string(playlist, local_files_map):
	lines = []
	for spotify_song in playlist["songs"]:
		spotify_song["length"] = spotify_song.get("duration", -1) // 1000
		line =  u"#EXTINF:%(length)s, %(artists)s - %(name)s" % spotify_song
		lines.append(line); # print line.encode('ascii', errors='ignore')
		line = get_local_song_location(spotify_song, local_files_map)
		lines.append(line); # print line.encode('ascii', errors='ignore')
	return u'\n'.join(lines)


def convert_to_m3u(destination_map, dirname, fnames):
	for forbidden in ['.git', 'users', 'Friends_List', 'm3u', 'xspf']:
		if forbidden in fnames:
			fnames.remove(forbidden)
	destination = dirname
        for k, v in destination_map.items():
		destination = destination.replace(k, v, 1)
	if not os.path.exists(destination):
		os.mkdir(destination)
	for fname in fnames:
		if not fname.endswith('json'):
			continue
		logger.debug("%s/%s", dirname, fname)
		playlist = json.load(open(dirname+'/'+fname))
		if 'songs' not in playlist:
			continue
		playlist["songs"].remove({})
		add_jol_links(playlist)
		m3u_string = get_m3u_string(playlist, local_files_map)
		m3u_string = m3u_string.replace("DOWNLOADING",
			"C:/users/alsuren/music/incoming")
		m3u_string = m3u_string.replace("/", "\\")
		# print repr(m3u_string)
		f = open("%s/%s.m3u" % (destination, fname), "w")
		f.write(m3u_string.encode('ascii', errors="ignore"))

def get_xspf_string(playlist, local_files_map):
	lines = ['<?xml version="1.0" encoding="UTF-8"?><playlist xmlns="http://xspf.org/ns/0/" version="0"><trackList>']
	for spotify_song in playlist["songs"]:
		spotify_song["length"] = spotify_song.get("duration", -1) // 1000
		lines.append('\t<track>')
		for artist in spotify_song["artists"][:1]:
			lines.append("\t\t<creator>%s</creator>"
				% escape(artist))
		lines.append("\t\t<title>%s</title>"
			% escape(spotify_song['name']))
		lines.append("\t\t<duration>%s</duration>"
			% spotify_song['duration'])
		lines.append("\t\t<album>%s</album>"
			% escape(spotify_song['album']))

		location = get_local_song_location(spotify_song, local_files_map)
		if 0 and location and not location.startswith('#') \
				and "DOWNLOAD" not in location:
			lines.append("\t\t<location>file://%s</location>" % location)
		lines.append('\t</track>')
	lines.append('</trackList></playlist>')
	return u'\n'.join(lines)


def convert_to_xspf(destination_map, dirname, fnames):
	for forbidden in ['.git', 'users', 'Friends_List', 'm3u', 'xspf']:
		if forbidden in fnames:
			fnames.remove(forbidden)
	destination = dirname
        for k, v in destination_map.items():
		destination = destination.replace(k, v, 1)
	if not os.path.exists(destination):
		os.mkdir(destination)
	for fname in fnames:
		if not fname.endswith('json'):
			continue
		logger.debug("%s", dirname+'/'+fname)
		playlist = json.load(open(dirname+'/'+fname))
		if 'songs' not in playlist:
			continue
		playlist["songs"].remove({})
		add_jol_links(playlist)
		xspf_string = get_xspf_string(playlist, local_files_map)
		f = open("%s/%s.xspf" % (destination, fname), "w")
		f.write(xspf_string.encode('ascii', errors="ignore"))



if __name__ == "__main__":
    handler = logging.FileHandler('.jolify.log')
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    structured_listing = get_structured_listing("listing.txt")
    songs_by_artist_name = get_name_artist_map(structured_listing)
    songs_by_name_artist = transpose(songs_by_artist_name)

    if os.path.exists("local_files_map.json"):
        local_files_map = json.load(open("local_files_map.json"))
    else:
        local_files_map = make_local_files_map("C:/users/alsuren/music")
        json.dump(local_files_map, open("local_files_map.json", "w"), indent=1)

    try:
	    os.path.walk(".", convert_to_xspf, {".": "xspf"})
    finally:
	    json.dump(local_files_map, open("local_files_map_end.json", "w"), indent=1)

