# Tomahawk Resolvers

Supported resolvers are distributed and updated automatically through Tomahawk's Settings dialog.
To manually install a resolver either 
* clone this repo, or
* download the .zip (see .zip button at the top of the repo page at https://github.com/tomahawk-player/tomahawk-resolvers), or 
* download all the files within the individual resolver folder you are installing.

After you have the files locally, open Tomahawk's preferences and from the "Services" tab click "Install from File" and select the .axe or .js file for the resolver you are installing.

Since March 2013 Tomahawk resolvers have switched to a new directory structure for easy packaging. Ideally, you should download [nightly .axe files](http://teom.org/axes/nightly/), if available.

For developer documentation, see [HACKING.md](HACKING.md).

## Capabilities

Not all resolvers feature the same capabilities, this is either due to the lacking capabilities of the service they connect to or that the capability is not yet implemented.
Some of the features need authentication (e.g. being a premium subscriber to this service), some can be used without any subscription or authentication at all.

**Available Capabilities:**
* **Resolving**: Given a tuple of `Artist,Track` (or a triple `Artist,Album,Track`) return a stream URL (and some metadata about it) so that one can play this track.
* **Search**: (Fuzzily) find tracks, artists and albums on all services matching a query that can be streamed.
* **Open Artist URL**: Given an URL about an artist of a service, return the information about that. (This opens the artist page in Tomahawk).
* **Open Album URL**: Given an URL about an album of a service, return the information about that. (This opens the album page in Tomahawk).
* **Open Playlist**: Given an URL about a playlist of a service, return the information about that. (This imports the playlist in Tomahawk if it was not previously imported)
* **Open Track URL**: Given an URL about a track of a service, return the information about that. (This opens the track page in Tomahawk and plays it).
* **Collection**: Browse the collection of music stored by the user in this service.

**Legend:**
* ✔ - Supports without authentication
* :key: - Authentication required
* ? - Unknown
* ✘ - No support for this capability

**Notes:**
* Some services can search without being authenticated but only resolve after authentication. At the moment, we do not support this in Tomahawk but this may change in future.

| *Resolver* | Resolving | Search | Open Artist URL | Open Album URL | Open Playlist | Open Track URL | Collection |
|:----------:|:---------:|:------:|:---------------:|:--------------:|:-------------:|:--------------:|:----------:|
| 4shared    | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| 8tracks    | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| ampache    | :key:     | :key:  | ✘               | ✘              | ✘             | ✘              | :key:      |
| bandcamp   | ✔         | ✘      | ✔               | ✔              | ✘             | ✔              | ✘          |
| beatsmusic | :key:     | ✔      | ✔               | ✔              | :key:         | ✔              | ✘          |
| beets      | :key:     | :key:  | ✘               | ✘              | ✘             | ✘              | :key:      |
| deezer-metadata | ✘    | ✘      | ✔               | ✔              | ✔             | ✔              | ✘          |
| dilandau   | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| exfm       | ✔         | ✔      | ✘               | ✘              | ✔             | ✔              | ✘          |
| grooveshark | :key:    | :key:  | ✘               | ✘              | ✘             | ✘              | ✘          |
| jamendo    | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| jazz-on-line | ?       | ?      | ?               | ?              | ?             | ?              | ?          |
| lastfm     | ✔         | ✘      | ✘               | ✘              | ✘             | ✘              | ✘          |
| muzebra    | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| officialfm | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| qobuz      | :key:     | :key:  | ✘               | ✘              | ✘             | ✘              | ✘          |
| rdio-metadata | ✘      | ✘      | ✔               | ✔              | ✔             | ✔              | ✘          |
| soundcloud | ✔         | ✔      | ✔               | ✔              | ✔             | ✔              | ✘          |
| spotify-metadata | ✘   | ✘      | ✔               | ✔              | ✔             | ✔              | ✘          |
| spotify    | :key:     | :key:  | ✘               | ✘              | :key:         | ✘              | ✘          |
| subsonic   | :key:     | :key:  | ✘               | ✘              | ✘             | ✘              | :key:      |
| synology-audiostation  | :key:  | :key:           | ✘              | ✘             | ✘              | ✘          | :key:    |
| tomahk-metadata | ✘    | ✘      | ✔               | ✔              | ✔             | ✔              | ✘          |
| vibe3      | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| vkontakte  | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| youtube    | ✔         | ✔      | ✘               | ✘              | ✘             | ✘              | ✘          |
| youtube-metadata    | ✘         | ✘      | ✘               | ✘              | ✔             | ✔              | ✘          |
