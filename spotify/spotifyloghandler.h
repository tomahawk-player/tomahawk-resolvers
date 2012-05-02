/*
    Copyright (c) 2011 Leo Franchi <leo@kdab.com>

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/
#ifndef SPOTIFYLOGHANDLER_H
#define SPOTIFYLOGHANDLER_H


#ifdef WIN32
#include <shlobj.h>
#endif
#include <QTimer>
#include <QTextStream>
#include <QSettings>
#include <QSocketNotifier>
#include <QDir>
#include <QDateTime>
#include <QUuid>
#include <QtCore/QTimer>
#include <QtCore/QFile>
#include <QMutex>
#include <QDebug>
#include <QtGlobal>

#include <iostream>
#include <stdio.h>
#include <fstream>
#include <qendian.h>

#include "spotifyresolver.h"

#ifdef Q_WS_MAC
#define SPOTIFY_LOGFILE QDir::home().filePath( "Library/Logs/SpotifyResolver.log" ).toLocal8Bit()
#else
#define SPOTIFY_LOGFILE QDir( SpotifyResolver::dataDir() ).filePath( "SpotifyResolver.log" ).toLocal8Bit()
#endif

#ifdef Q_WS_MAC
#define SPOTIFY_CACHEDIR QString( QDir::home() + QDir::separator() + "Library/Caches/SpotifyResolver/" ).toLocal8Bit()
#else
#define SPOTIFY_CACHEDIR QString( SpotifyResolver::dataDir() + QDir::separator() + "cache" + QDir::separator() ).toLocal8Bit()
#endif

#define SPOTIFY_LOGFILE_SIZE 1024 * 512

void LogHandler( QtMsgType type, const char *msg );
void setupLogfile();

#endif // SPOTIFYLOGHANDLER_H
