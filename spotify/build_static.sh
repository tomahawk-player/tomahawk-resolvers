#!/bin/bash
mkdir static
pushd static
cmake -DQJSON_INCLUDE_DIR=/Users/leo/src/qjson/static/include/ -DQJSON_LIBRARIES=/Users/leo/src/qjson/static/lib/libqjson.a ..
make -j10
popd
