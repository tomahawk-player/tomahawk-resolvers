#!/bin/bash
echo "Building static binary. Please make sure you have a libdl.a in this directory as well as a libspotify.so.12."
echo "Remove any libspotify.so installed in system-wide paths, as well."
echo "\n\n"

mkdir static
pushd static
cp ../libdl.a .
cp ../libspotify.so.12 .
ln -s libspotify.so.12 libspotify.so
cmake -DQJSON_INCLUDE_DIR=/home/leo/kde-static/include/ -DQJSON_LIBRARIES=/home/leo/kde-static/lib/libqjson.a ..
make -j10
popd
