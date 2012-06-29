#!/bin/bash
STATIC_QT=/Users/leo/src/qt-static/bin 
mkdir static
pushd static
PATH=$STATIC_QT:$PATH cmake -DQJSON_INCLUDE_DIR=/Users/leo/src/qjson/static/include/ -DQJSON_LIBRARIES=/Users/leo/src/qjson/static/lib/libqjson.a ..
PATH=$STATIC_QT:$PATH make -j10
popd
