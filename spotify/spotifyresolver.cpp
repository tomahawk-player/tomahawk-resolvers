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
#include "qxthttpsessionmanager.h"
#include "spotifysearch.h"
#include <libspotify/api.h>
#include "qjson/parser.h"
#include "qjson/serializer.h"
#include "spotifyloghandler.h"
#include "spotifysession.h"
#include <QTimer>
#include <QTextStream>
#include <QSettings>
#include <QSocketNotifier>
#include <QDir>
#include <QDateTime>
#include <QUuid>
#include <QtCore/QTimer>
#include <QtCore/QFile>
#include <QDesktopServices>
#include <qendian.h>

#include <iostream>
#include <stdio.h>
#include <fstream>
#include "audiohttpserver.h"

#ifdef WIN32
#include <shlobj.h>
#endif


QDataStream& operator<<(QDataStream& out, const CacheEntry& cache)
{
    out << (quint32)cache.count();
    foreach( const QString& key, cache.keys() )
    {

        out << key << cache[ key ];
    }
    return out;
}


QDataStream& operator>>(QDataStream& in, CacheEntry& cache)
{
    quint32 count = 0;
    in >> count;
    for ( uint i = 0; i < count; i++ )
    {
        QString key, val;
        in >> key;
        in >> val;
        cache[ key ] = val;
    }
    return in;
}

SpotifyResolver::SpotifyResolver( int& argc, char** argv )
    : QCoreApplication( argc, argv )
    , m_session( 0 )
    , m_stdinWatcher( 0 )
    , m_handler( 0 )
    , m_loggedIn( false )
    , m_apiKey( QByteArray::fromBase64( spotifyApiKey ) )
    , m_highQuality( true )
{
    setOrganizationName( QLatin1String( "TomahawkSpotify" ) );
    setOrganizationDomain( QLatin1String( "tomahawk-player.org" ) );
    setApplicationName( QLatin1String( "SpotifyResolver" ) );
    setApplicationVersion( QLatin1String( "2.0" ) );

}


SpotifyResolver::~SpotifyResolver()
{
    qDebug() << "exiting...";
    delete m_session;
    delete m_stdinWatcher;
    m_stdinThread.exit();
}

void SpotifyResolver::setup()
{
    setupLogfile();

    qDebug() << "Initializing Spotify";
    const QByteArray storagePath = dataDir().toUtf8();
    const QByteArray configPath = dataDir( true ).toUtf8();
    const QString tracePath = dataDir() + "/" + "trace.dat";

    loadSettings();

    // sessionConfig
    sessionConfig config;
    config.cache_location = storagePath;
    config.settings_location = configPath;
    config.application_key = m_apiKey;
    config.application_key_size = m_apiKey.size();
    config.user_agent = "tomahawkresolver";
    config.tracefile = tracePath.toUtf8();
    config.device_id = "tomahawkspotify";

    // When signal is emitted, you are logged in
    m_session = new SpotifySession(config);
    connect( m_session, SIGNAL( notifyLoggedInSignal() ), this, SLOT( notifyLoggedIn() ) );

    // Signals
    connect( m_session, SIGNAL(notifySyncUpdateSignal(SpotifyPlaylists::LoadedPlaylist) ), this, SLOT( notifySyncUpdate(SpotifyPlaylists::LoadedPlaylist) ) );
    connect( m_session, SIGNAL(notifyStarredUpdateSignal(SpotifyPlaylists::LoadedPlaylist) ), this, SLOT( notifyStarredUpdate(SpotifyPlaylists::LoadedPlaylist) ) );


    // read stdin
    m_stdinWatcher = new ConsoleWatcher( 0 );
    connect( m_stdinWatcher, SIGNAL( lineRead( QVariant ) ), this, SLOT( playdarMessage( QVariant ) ) );
    m_stdinWatcher->moveToThread( &m_stdinThread );
    m_stdinThread.start( QThread::LowPriority );

}

void SpotifyResolver::notifySyncUpdate( SpotifyPlaylists::LoadedPlaylist pl )
{
    qDebug() << "Got playlist to update";

    if ( !pl.playlist_ || !sp_playlist_is_loaded( pl.playlist_ ) )
    {
        qDebug() << "NULL or not loaded playlist in callbacK!";
        return;
    }

    QVariantMap resp;
    resp[ "qid" ] = pl.id_;
    resp[ "identifier" ] = pl.name_;
    resp[ "_msgtype" ] = "playlist";

    QVariantList results;

    foreach( sp_track *tr, pl.tracks_ )
    {
        if ( !tr || sp_track_is_loaded( tr ) )
        {
            qDebug() << "IGNORING not loaded track!";
            continue;
        }

        QVariantMap track;
        track[ "track" ] = "Test Track Name"; //QString::fromUtf8( sp_track_name( tr ) );
        track[ "artist" ] = "Test Artist"; // QString::fromUtf8( sp_artist_name( sp_track_artist( tr, 0 ) ) );
        results << track;
    }

    resp[ "playlist" ] = results;
    sendMessage( resp );
}

void SpotifyResolver::notifyStarredUpdate( SpotifyPlaylists::LoadedPlaylist pl )
{
    qDebug() << "Got starred playlist to update";

    if ( !pl.playlist_ || !sp_playlist_is_loaded( pl.playlist_ ) )
    {
        qDebug() << "NULL or not loaded playlist in callbacK!";
        return;
    }

    QVariantMap resp;
    resp[ "qid" ] = pl.id_;
    resp[ "identifier" ] = pl.name_;
    resp[ "_msgtype" ] = "playlist";

    QVariantList results;

    foreach( sp_track *tr, pl.tracks_ )
    {
        if ( !tr || sp_track_is_loaded( tr ) )
        {
            qDebug() << "IGNORING not loaded track in starred!";
            continue;
        }
        QVariantMap track;
        track[ "track" ] = "Test Track Name"; //QString::fromUtf8( sp_track_name( tr ) );
        track[ "artist" ] = "Test Artist"; // QString::fromUtf8( sp_artist_name( sp_track_artist( tr, 0 ) ) );
        results << track;
    }

    resp[ "playlist" ] = results;
    sendMessage( resp );

}


void SpotifyResolver::initSpotify()
{
    m_port = 55050;
    m_httpS.setPort( m_port ); //TODO config
    m_httpS.setListenInterface( QHostAddress::LocalHost );
    m_httpS.setConnector( &m_connector );

    m_handler = new AudioHTTPServer( &m_httpS, m_httpS.port() );
    m_httpS.setStaticContentService( m_handler );

    qDebug() << "Starting HTTPd on" << m_httpS.listenInterface().toString() << m_httpS.port();
    m_httpS.start();

    m_dirty = false;
    QTimer* t = new QTimer( this );
    t->setInterval( 5000 );
    connect( t, SIGNAL( timeout() ), this, SLOT( saveCache() ) );
    t->start();

    login();
    loadCache();


    // testing
//     search( "123", "coldplay", "the scientist" );
}

void SpotifyResolver::notifyLoggedIn()
{
    qDebug() << "Succesfully logged in!";
    m_loggedIn = true;

    if( m_loggedIn ) {
        sendSettingsMessage();
        sp_session_preferred_bitrate( m_session->Session(), m_highQuality ? SP_BITRATE_320k : SP_BITRATE_160k );
    }
}


void SpotifyResolver::sendSettingsMessage()
{
    QVariantMap m;
    m[ "_msgtype" ] = "settings";
    m[ "name" ] = "Spotify";
    m[ "weight" ] = "90";
    m[ "timeout" ] = "10";

    sendMessage( m );
}


void
SpotifyResolver::playdarMessage( const QVariant& msg )
{
    //qDebug() << "Got playdar message!" << msg;

    if( !msg.canConvert< QVariantMap >() ) {
        qWarning() << "Got non-map in json!";
        return;
    }

    QVariantMap m = msg.toMap();

    if( m.value( "_msgtype" ) == "saveSettings" )
    {
        m_username = m[ "username" ].toString();
        m_pw = m[ "password" ].toString();
        m_highQuality = m[ "highQuality" ].toBool();

        login();
        saveSettings();

    }
    else if ( m.value( "_msgtype" ) == "getCredentials" )
    {
        // For migrating to tomahawk accounts
        qDebug() << "Tomahawk asked for credentials, sending!";
        QVariantMap msg;

        msg[ "_msgtype" ] = "credentials";
        msg[ "username" ] = m_username;
        msg[ "password" ] = m_pw;
        msg[ "highQuality" ] = m_highQuality;

        sendMessage( msg );
    }
    else if( m.value( "_msgtype" ) == "rq" )
    {
        if( !m_loggedIn )
            return;

        const QString qid = m.value( "qid" ).toString();
        const QString artist = m.value( "artist" ).toString();
        const QString track = m.value( "track" ).toString();
        const QString fullText = m.value( "fulltext" ).toString();

        qDebug() << "Resolving:" << qid << artist << track << "fulltext?" << fullText;

        search( qid, artist, track, fullText );
    }
    else if( m.value( "_msgtype" ) == "config" ) {
        const QByteArray configPath = dataDir( true ).toUtf8();
        QString settingsFilename( QString( configPath ) + "/settings" );

        qDebug() << "Looking for spotify settings file at " << settingsFilename;

        QFile settingsFile( settingsFilename );
        QVariantMap spotifySettings;
        bool ok = true;

        if ( settingsFile.exists() && settingsFile.size() > 0 )
        {
            qDebug() << "Found spotify settings file, parsing...";
            QJson::Parser parser;
            settingsFile.open( QIODevice::ReadOnly | QIODevice::Text );
            QString settingsString = settingsFile.readAll();
            settingsFile.close();
            spotifySettings = parser.parse( settingsString.toLocal8Bit(), &ok ).toMap();
        }

        if ( !ok )
        {
            qDebug() << "Previous spotify settings file found but could not be read successfully";
            QTimer::singleShot( 0, this, SLOT( initSpotify() ) );
            return;
        }

        if ( m.value( "proxytype" ) == "socks5" )
        {
            if ( m.value( "proxypass" ).toString().isEmpty() )
            {
                QString proxyString = QString( "%1:%2@socks5" ).arg( m.value( "proxyhost" ).toString() ).arg( m.value( "proxyport" ).toString() );
                spotifySettings["proxy"] = proxyString;
                spotifySettings["proxy_mode"] = 2;
                spotifySettings["proxy_pass"] = QString();
            }
            else
            {
                qDebug() << "The Spotify resolver does not currently support SOCKS5 proxies with a username and password";
                QTimer::singleShot( 0, this, SLOT( initSpotify() ) );
                return;
            }
        }
        else
        {
            spotifySettings.remove( "proxy" );
            spotifySettings.remove( "proxy_pass" );
            spotifySettings.remove( "proxy_mode" );
        }
        settingsFile.open( QIODevice::WriteOnly | QIODevice::Text | QIODevice::Truncate );
        QJson::Serializer serializer;
        QByteArray json = serializer.serialize( spotifySettings );
        settingsFile.write( json );
        settingsFile.close();
        QTimer::singleShot( 0, this, SLOT( initSpotify() ) );
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


void SpotifyResolver::search( const QString& qid, const QString& artist, const QString& track, const QString& fullText )
{
    // search spotify..
    // do some cleanups.. remove ft/feat
    QString query;
    UserData* data = new UserData( qid, this );

    if ( fullText.isEmpty() )
    {
        // Not a search, just a track resolve.
        QString cleanedTrack = track;
        if( cleanedTrack.indexOf( "feat" ) > -1 )
            cleanedTrack = cleanedTrack.mid( cleanedTrack.indexOf( "feat" ) );
        if( cleanedTrack.indexOf( "ft." ) > -1 )
            cleanedTrack = cleanedTrack.mid( cleanedTrack.indexOf( "ft." ) );

        query = QString( "%1 %2" ).arg( artist ).arg( cleanedTrack );
    }
    else
    {
        // fulltext search
        query = fullText;
        data->fulltext = true;
    }
    sp_search_create( m_session->Session(), query.toUtf8().data(), 0, data->fulltext ? 50 : 1, 0, 0, 0, 0, &SpotifySearch::searchComplete, data );
}

void
SpotifyResolver::loadCache()
{
    QFile f( QDesktopServices::storageLocation( QDesktopServices::CacheLocation ) + "/SpotifyResolver/cache.dat" );
    if ( !f.open( QIODevice::ReadOnly ) )
        return;
    QDataStream stream( &f );

    stream >> m_cachedTrackLinkMap;
    qDebug() << "LOADED CACHED:" << m_cachedTrackLinkMap.count();
    f.close();

    if ( QFileInfo( f.fileName() ).size() > 10 * SPOTIFY_LOGFILE_SIZE )
    {
        QFile::remove( f.fileName() );
    }
}


void
SpotifyResolver::saveCache()
{
    if ( !m_dirty )
        return;
    m_dirty = false;

    const QString dir = QDesktopServices::storageLocation( QDesktopServices::CacheLocation );
    QDir d( dir );
    if ( !d.exists( "SpotifyResolver" ) )
    {
        bool ret = d.mkpath( "SpotifyResolver/" );
    }

    QFile f( QDesktopServices::storageLocation( QDesktopServices::CacheLocation ) + "/SpotifyResolver/cache.dat" );
    if ( !f.open( QIODevice::WriteOnly ) )
        return;

    QDataStream stream( &f );

    stream << m_cachedTrackLinkMap;
    f.close();
}


QString SpotifyResolver::addToTrackLinkMap(sp_link* link)
{
    QString uid = QUuid::createUuid().toString().replace( "{", "" ).replace( "}", "" ).replace( "-", "" );
    m_trackLinkMap.insert( uid, link );

    QSettings s;
    char url[1024];
    sp_link_as_string( link, url, sizeof( url ) );

    m_cachedTrackLinkMap[ uid ] = url;
    m_dirty = true;
    return uid;
}

sp_link* SpotifyResolver::linkFromTrack(const QString& uid)
{
    if ( sp_link* l = m_trackLinkMap.value( uid, 0 ) )
        return l;

    QString linkStr = m_cachedTrackLinkMap.value( uid );
    if (!linkStr.isEmpty() )
    {
        sp_link* l = sp_link_create_from_string( linkStr.toAscii() );
        m_trackLinkMap[ uid ] = l;
        return l;
    }
    return 0;
}

void SpotifyResolver::removeFromTrackLinkMap(const QString& linkStr)
{
    m_trackLinkMap.remove( linkStr );
}

bool SpotifyResolver::hasLinkFromTrack(const QString& linkStr)
{
   return m_trackLinkMap.contains( linkStr ) || m_cachedTrackLinkMap.contains( linkStr );
}

/// misc stuff

void SpotifyResolver::loadSettings()
{
    QSettings s;
    m_username = s.value( "username", QString() ).toString();
    m_pw = s.value( "password", QString() ).toString();
    m_highQuality = s.value( "highQualityStreaming", true ).toBool();
}

void SpotifyResolver::saveSettings() const
{
    QSettings s;
    s.setValue( "username", m_username );
    s.setValue( "password", m_pw );
    s.setValue( "highQualityStreaming", m_highQuality );
}

void SpotifyResolver::login()
{
    if( !m_username.isEmpty() && !m_pw.isEmpty() ) { // log in
        qDebug() << "Logging in with username:" << m_username;
        m_session->setCredentials( m_username, m_pw  );
        m_session->login();
    }
}


QString SpotifyResolver::dataDir( bool configDir )
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
        path = QDir::home().filePath( configDir ? ".config" : ".local/share" );
#else
        path = QCoreApplication::applicationDirPath();
#endif

    path += "/" + QCoreApplication::applicationName();
    QDir d( path );
    d.mkpath( path );

    qDebug() << "Using SpotifyResolver log dir:" << path;
    return path;
}

void
SpotifyResolver::instanceStarted( KDSingleApplicationGuard::Instance )
{
    // well goodbye!
    qApp->quit();
}
