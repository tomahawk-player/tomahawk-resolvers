#!/bin/bash
# usage: pack.sh x86|x64 version path_to_pem
cd /home/spotify/tomahawk-resolvers/admin/spotify-synchrotron/linux && ruby create_synchrotron.rb $1 $2 /home/spotify/spotify-static-build/spotify-linux-$1 spotify_tomahawkresolver /home/spotify/tomahawk-resolvers/spotify/spotify.desktop $3 /home/spotify/tomahawk-synchrotron

