#!/bin/bash
echo "Building static binary. Please make sure you have a libdl.a in this directory as well as a libspotify.so.12."
echo "Remove any libspotify.so installed in system-wide paths, as well."
echo "\n\n"

mkdir static
pushd static
cp ../libdl.a .
cp ../libspotify.so.12 .
ln -s libspotify.so.12 libspotify.so
cmake -DQJSON_INCLUDE_DIR=/home/spotify/qjson-install/include/ -DQJSON_LIBRARIES=/home/spotify/qjson-install/lib/libqjson.a \
-DLIBSPOTIFY_INCLUDE_DIR=/home/spotify/libspotify-12.1.51-Linux-x86_64-release/include -DLIBSPOTIFY_LIBRARIES=/home/spotify/libspotify-12.1.51-Linux-x86_64-release/lib \
-DWITH_BREAKPAD=OFF ..
make -j10
popd
