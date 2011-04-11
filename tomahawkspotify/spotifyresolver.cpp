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


#include "spotifyresolver.h"

#include "spotify_key.h"
#include "consolewatcher.h"
#include "callbacks.h"

#include <libspotify/api.h>
#include "qjson/parser.h"
#include "qjson/serializer.h"

#include <QTimer>
#include <QTextStream>
#include <QSettings>
#include <QSocketNotifier>
#include <QDir>
#include <QUuid>
#include <qendian.h>

#include <iostream>
#include <stdio.h>
#include <fstream>
#include "audiohttpserver.h"
#include <QDateTime>

namespace SpotifyCallbacks {

static sp_session_callbacks callbacks = {
    &SpotifyCallbacks::loggedIn,
    &SpotifyCallbacks::loggedOut,
    &SpotifyCallbacks::metadataUpdated,
    &SpotifyCallbacks::connectionError,
    &SpotifyCallbacks::messageToUser,
    &SpotifyCallbacks::notifyMainThread,
    &SpotifyCallbacks::musicDelivery,
    &SpotifyCallbacks::playTokenLost,
    &SpotifyCallbacks::logMessage,
    &SpotifyCallbacks::endOfTrack,
    &SpotifyCallbacks::streamingError,
    #if SPOTIFY_API_VERSION > 4
    &SpotifyCallbacks::userinfoUpdated,
    &SpotifyCallbacks::startPlayback,
    &SpotifyCallbacks::stopPlayback,
    &SpotifyCallbacks::getAudioBufferStats
    #else
    &SpotifyCallbacks::userinfoUpdated
    #endif
};
}

#define LOGFILE QDir( SpotifyResolver::dataDir() ).filePath( "SpotifyResolver.log" ).toLocal8Bit()
#define LOGFILE_SIZE 1024 * 512
std::ofstream logfile;

void LogHandler( QtMsgType type, const char *msg )
{
    static QMutex s_mutex;

    QMutexLocker locker( &s_mutex );
    switch( type )
    {
        case QtDebugMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Debug: " << msg << "\n";
            break;

        case QtCriticalMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Critical: " << msg << "\n";
            break;

        case QtWarningMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Warning: " << msg << "\n";
            break;

        case QtFatalMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Fatal: " << msg << "\n";
            logfile.flush();
/*
            cout << msg << "\n";
            cout.flush();*/
            abort();
            break;
    }

//     std::cout << msg << "\n";
//     cout.flush();
    logfile.flush();
}

void setupLogfile()
{
    if ( QFileInfo( LOGFILE ).size() > LOGFILE_SIZE )
    {
        QByteArray lc;
        {
            QFile f( LOGFILE );
            f.open( QIODevice::ReadOnly | QIODevice::Text );
            lc = f.readAll();
            f.close();
        }

        QFile::remove( LOGFILE );

        {
            QFile f( LOGFILE );
            f.open( QIODevice::WriteOnly | QIODevice::Text );
            f.write( lc.right( LOGFILE_SIZE - (LOGFILE_SIZE / 4) ) );
            f.close();
        }
    }

    logfile.open( LOGFILE, std::ios::app );
    qInstallMsgHandler( LogHandler );
}



SpotifyResolver::SpotifyResolver( int argc, char** argv )
    : QCoreApplication( argc, argv )
    , m_session( 0 )
    , m_stdinWatcher( 0 )
    , m_server( 0 )
    , m_loggedIn( false )
    , m_trackEnded( false )
{
    setOrganizationName( QLatin1String( "TomahawkSpotify" ) );
    setOrganizationDomain( QLatin1String( "tomahawk-player.org" ) );
    setApplicationName( QLatin1String( "SpotifyResolver" ) );
    setApplicationVersion( QLatin1String( "0.1" ) );

    setupLogfile();
    connect( this, SIGNAL( notifyMainThreadSignal() ), this, SLOT( notifyMainThread() ) );

    // read stdin
    m_stdinWatcher = new ConsoleWatcher( 0 );
    connect( m_stdinWatcher, SIGNAL( lineRead( QVariant ) ), this, SLOT( playdarMessage( QVariant ) ) );
    m_stdinWatcher->moveToThread( &m_stdinThread );
    m_stdinThread.start( QThread::LowPriority );

    //initialize spotify session
    const QByteArray settingsPath = dataDir().toUtf8();
    m_config.api_version = SPOTIFY_API_VERSION;
    m_config.cache_location = settingsPath.constData();
    m_config.settings_location = settingsPath.constData();
    m_config.application_key = g_appkey;
    m_config.application_key_size = g_appkey_size;
    m_config.user_agent = "tomahawkresolver";
    m_config.callbacks = &SpotifyCallbacks::callbacks;

    sp_error err = sp_session_create(&m_config, &m_session);
    if (SP_ERROR_OK != err) {
        qWarning() << "Failed to create spotify session: " << sp_error_message(err);
    }

    m_server = new AudioHTTPServer;

    loadSettings();
}

SpotifyResolver::~SpotifyResolver()
{
    qDebug() << "exiting...";
    sp_session_logout( m_session );

    delete m_stdinWatcher;
    m_stdinThread.exit();
}

void SpotifyResolver::setLoggedIn( bool loggedIn )
{
    // send settings message to tomahawk
    QVariantMap m;
    m[ "_msgtype" ] = "settings";
    m[ "name" ] = "Spotify";
    m[ "weight" ] = "95";
    m[ "timeout" ] = "100";
    m[ "preferences" ] = "login";

    sendMessage( m );
}


void SpotifyResolver::sendNotifyThreadSignal()
{
    emit notifyMainThreadSignal();
}


void SpotifyResolver::notifyMainThread()
{
    int timeout;
    do {
        sp_session_process_events( m_session, &timeout );
    } while( !timeout );
    QTimer::singleShot( timeout, this, SLOT( notifyMainThread() ) );
}

void
SpotifyResolver::playdarMessage( const QVariant& msg )
{
//     qDebug() << "Got playdar message!" << msg;
    if( !msg.canConvert< QVariantMap >() ) {
        qWarning() << "Got non-map in json!";
        return;
    }
    QVariantMap m = msg.toMap();
    if( m.value( "_msgtype" ) == "setpref" ) {
        QVariantList l = m[ "prefs" ].toList();
        foreach( const QVariant& p, l ) {
            if( !p.canConvert< QVariantMap >() )
                continue;
            QVariantMap pref = p.toMap();
            Q_ASSERT( pref.contains( "username" ) && pref.contains( "password" ) );
            m_username = pref[ "username" ].toString();
            m_pw = pref[ "password" ].toString();

            login();
        }
    } else if( m.value( "_msgtype" ) == "rq" ) {
        QString qid = m.value( "qid" ).toString();
        QString artist = m.value( "artist" ).toString();
        QString track = m.value( "track" ).toString();

        qDebug() << "Resolving:" << qid << artist << track;

        search( qid, artist, track );
    }
}

void SpotifyResolver::sendMessage(const QVariant& v)
{
    QJson::Serializer s;
    QByteArray msg = s.serialize( v );
    quint32 len;
    qToBigEndian( msg.length(), (uchar*) &len );

//     QByteArray outB;
//     QDataStream out( &outB, QIODevice::WriteOnly );
    QFile out;
    out.open( stdout, QIODevice::WriteOnly );
    out.write( (const char*) &len, 4 );
    out.write( msg );
    out.close();

}


void SpotifyResolver::search( const QString& qid, const QString& artist, const QString& track )
{
    // search spotify..
    QString query = QString( "%1 %2" ).arg( artist ).arg( track );
    QString data = QString( "%1~~~%2" ).arg( query ).arg( qid );
//     qDebug() << "Searching for:" << query;
    sp_search_create( m_session, query.toUtf8().data(), 0, 25, 0, 0, 0, 0, &SpotifyCallbacks::searchComplete, new QString(data) );
}


QString SpotifyResolver::addToTrackLinkMap(sp_link* link)
{
    QString uid = QUuid::createUuid().toString().replace( "{", "" ).replace( "}", "" ).replace( "-", "" );
    m_trackLinkMap.insert( uid, link );

    return uid;
}

sp_link* SpotifyResolver::linkFromTrack(const QString& linkStr)
{
    return m_trackLinkMap.value( linkStr, 0 );
}

void SpotifyResolver::removeFromTrackLinkMap(const QString& linkStr)
{
    m_trackLinkMap.remove( linkStr );
}

bool SpotifyResolver::hasLinkFromTrack(const QString& linkStr)
{
   return m_trackLinkMap.contains( linkStr );
}

QMutex& SpotifyResolver::dataMutex()
{
    return m_dataMutex;
}

QWaitCondition& SpotifyResolver::dataWaitCond()
{
    return m_dataWaitCondition;
}

void SpotifyResolver::queueData( const AudioData& data )
{
    m_audioData.enqueue( data );
}

AudioData SpotifyResolver::getData()
{
    return m_audioData.dequeue();
}

void SpotifyResolver::clearData()
{
    m_audioData.clear();
}


bool SpotifyResolver::hasData() const
{
    return !m_audioData.isEmpty();
}

void SpotifyResolver::startPlaying()
{
    m_trackEnded = false;
}


void SpotifyResolver::endOfTrack()
{
    m_trackEnded = true;
}

bool SpotifyResolver::trackIsOver()
{
    return m_trackEnded;
}



/// misc stuff

void SpotifyResolver::loadSettings()
{
    QSettings s;
    m_username = s.value( "username", QString() ).toString();
    m_pw = s.value( "password", QString() ).toString();

    login();
}

void SpotifyResolver::login()
{
    if( !m_username.isEmpty() && !m_pw.isEmpty() ) { // log in
        qDebug() << "Logging in with username:" << m_username;
        sp_session_login(m_session, m_username.toLatin1(),  m_pw.toLatin1());
    }
}


QString SpotifyResolver::dataDir()
{
    QString path;

#ifdef WIN32
    if ( ( QSysInfo::WindowsVersion & QSysInfo::WV_DOS_based ) == 0 )
    {
        // Use this for non-DOS-based Windowses
        char acPath[MAX_PATH];
        HRESULT h = SHGetFolderPathA( NULL, CSIDL_LOCAL_APPDATA | CSIDL_FLAG_CREATE,
                                        NULL, 0, acPath );
        if ( h == S_OK )
        {
            path = QString::fromLocal8Bit( acPath );
        }
    }
#elif defined(Q_WS_MAC)
        path = QDir::home().filePath( "Library/Application Support" );
#elif defined(Q_WS_X11)
        path = QDir::home().filePath( ".local/share" );
#else
        path = QCoreApplication::applicationDirPath();
#endif

    path += "/" + QCoreApplication::applicationName();
    QDir d( path );
    d.mkpath( path );

    //ap qDebug() << "Using SpotifyResolver log dir:" << path;
    return path;
}

#include "spotifyresolver.moc"
