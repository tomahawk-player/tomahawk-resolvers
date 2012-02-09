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

#include "spotifyloghandler.h"

std::ofstream spLogfile;

void LogHandler( QtMsgType type, const char *msg )
{
    static QMutex s_mutex;

    QMutexLocker locker( &s_mutex );
    switch( type )
    {
        case QtDebugMsg:
            spLogfile << QTime::currentTime().toString().toAscii().data() << " Debug: " << msg << "\n";
            break;

        case QtCriticalMsg:
            spLogfile << QTime::currentTime().toString().toAscii().data() << " Critical: " << msg << "\n";
            break;

        case QtWarningMsg:
            spLogfile << QTime::currentTime().toString().toAscii().data() << " Warning: " << msg << "\n";
            break;

        case QtFatalMsg:
            spLogfile << QTime::currentTime().toString().toAscii().data() << " Fatal: " << msg << "\n";
            spLogfile.flush();
/*
            cout << msg << "\n";
            cout.flush();*/
            abort();
            break;
    }

//     std::cout << msg << "\n";
//     cout.flush();
    spLogfile.flush();
}

void setupLogfile()
{
    if ( QFileInfo( SPOTIFY_LOGFILE ).size() > SPOTIFY_LOGFILE_SIZE )
    {
        QByteArray lc;
        {
            QFile f( SPOTIFY_LOGFILE );
            f.open( QIODevice::ReadOnly | QIODevice::Text );
            lc = f.readAll();
            f.close();
        }

        QFile::remove( SPOTIFY_LOGFILE );

        {
            QFile f( SPOTIFY_LOGFILE );
            f.open( QIODevice::WriteOnly | QIODevice::Text );
            f.write( lc.right( SPOTIFY_LOGFILE_SIZE - (SPOTIFY_LOGFILE_SIZE / 4) ) );
            f.close();
        }
    }
    qDebug() << SPOTIFY_LOGFILE;
    spLogfile.open( SPOTIFY_LOGFILE, std::ios::app );
    qInstallMsgHandler( LogHandler );
}

