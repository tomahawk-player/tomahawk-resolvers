/*
    Copyright (c) 2011-2012 Leo Franchi <lfranchi@kde.org>

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
#include "callbacks.h"
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
    config.user_agent = "Tomahawk Player";
    config.tracefile = tracePath.toUtf8();
    config.device_id = "tomahawkspotify";

    // When signal is emitted, you are logged in
    m_session = new SpotifySession(config);
    connect( m_session, SIGNAL( notifyLoggedInSignal() ), this, SLOT( notifyLoggedIn() ) );
    connect( m_session, SIGNAL( testLoginSucceeded( bool, QString ) ), this, SLOT( testLoginSucceeded( bool, QString ) ) );

    // Signals
    connect( m_session, SIGNAL(notifySyncUpdateSignal(SpotifyPlaylists::LoadedPlaylist) ), this, SLOT( sendPlaylist(SpotifyPlaylists::LoadedPlaylist) ) );

    connect( m_session->Playlists(), SIGNAL(sendTracksAdded(sp_playlist*,QList<sp_track*>,int)), this, SLOT(sendTracksAdded(sp_playlist*,QList<sp_track*>,int)));
    connect( m_session->Playlists(), SIGNAL(sendTracksMoved(sp_playlist*,QList<int>,int)), this, SLOT(sendTracksMoved(sp_playlist*,QList<int>,int)));
    connect( m_session->Playlists(), SIGNAL(sendTracksRemoved(sp_playlist*,QList<int>)), this, SLOT(sendTracksRemoved(sp_playlist*,QList<int>)));

    connect( m_session->Playlists(), SIGNAL( notifyContainerLoadedSignal() ), this, SLOT( notifyAllPlaylistsLoaded() ) );

    // read stdin
    m_stdinWatcher = new ConsoleWatcher( 0 );
    connect( m_stdinWatcher, SIGNAL( lineRead( QVariant ) ), this, SLOT( playdarMessage( QVariant ) ) );
    m_stdinWatcher->moveToThread( &m_stdinThread );
    m_stdinThread.start( QThread::LowPriority );

}

void SpotifyResolver::sendPlaylist( const SpotifyPlaylists::LoadedPlaylist& pl )
{
    qDebug() << "Sending playlist to client:" << pl.name_ << "with number of tracks:" << pl.tracks_.size();

    if ( !pl.playlist_ || !sp_playlist_is_loaded( pl.playlist_ ) )
    {
        qDebug() << "NULL or not loaded playlist in callbacK!";
        return;
    }

    QVariantMap resp;

    if ( m_playlistToQid.contains( pl.id_ ) )
        resp[ "qid" ] = m_playlistToQid.take( pl.id_ );

    resp[ "id" ] = pl.id_;
    resp[ "name" ] = pl.name_;
    resp[ "revid" ] = pl.revisions.last().revId;
    resp[ "sync" ] = pl.sync_;
    resp[ "_msgtype" ] = "playlist";

    QVariantList tracks;

    foreach( sp_track *tr, pl.tracks_ )
    {
        if ( !tr || !sp_track_is_loaded( tr ) )
        {
            qDebug() << "IGNORING not loaded track!";
            continue;
        }

        tracks << spTrackToVariant( tr );
    }

    resp[ "tracks" ] = tracks;

     QJson::Serializer s;
     QByteArray msg = s.serialize( resp );
     qDebug() << "SENDING PLAYLIST JSON:" << msg;

    sendMessage( resp );
}

void
SpotifyResolver::sendTracksAdded( sp_playlist* pl, QList< sp_track* > tracks, int pos )
{
    QVariantMap msg;
    msg[ "_msgtype" ] = "tracksAdded";

    SpotifyPlaylists::LoadedPlaylist lpl = m_session->Playlists()->getLoadedPlaylist( pl );

    int oldrev = -1;
    if ( lpl.revisions.size() >= 2 )
        oldrev = lpl.revisions.at( lpl.revisions.size() - 2 ).revId;

    msg[ "playlistid" ] = lpl.id_;
    msg[ "oldrev" ] = oldrev;
    msg[ "revid" ] = lpl.revisions.last().revId;
    msg[ "startPosition" ] = pos;

    QVariantList outgoingTracks;
    foreach( sp_track* track, tracks )
    {
        if ( !track || !sp_track_is_loaded( track ) )
        {
            qDebug() << "IGNORING not loaded track!";
            continue;
        }

        outgoingTracks << spTrackToVariant( track );
    }

    msg[ "tracks" ] = outgoingTracks;

    sendMessage( msg );
}


void
SpotifyResolver::sendTracksMoved( sp_playlist* pl, QList< int > tracks, int pos )
{
    // TODO
}


void
SpotifyResolver::sendTracksRemoved( sp_playlist* pl, QList< int > tracks )
{
    QVariantMap msg;
    msg[ "_msgtype" ] = "tracksRemoved";

    SpotifyPlaylists::LoadedPlaylist lpl = m_session->Playlists()->getLoadedPlaylist( pl );

    int oldrev = -1;
    if ( lpl.revisions.size() >= 2 )
        oldrev = lpl.revisions.at( lpl.revisions.size() - 2 ).revId;

    msg[ "playlistid" ] = lpl.id_;
    msg[ "oldrev" ] = oldrev;
    msg[ "revid" ] = lpl.revisions.last().revId;

    QVariantList trackPos;
    foreach( int track, tracks )
        trackPos << track;

    msg[ "trackPositions" ] = trackPos;

    sendMessage( msg );
}


void
SpotifyResolver::sendAddTracksResult( const QString& spotifyId, bool result )
{
    QVariantMap resp;
    SpotifyPlaylists::LoadedPlaylist pl = m_session->Playlists()->getPlaylist( spotifyId );

    if ( m_playlistToQid.contains( pl.id_ ) )
        resp[ "qid" ] = m_playlistToQid.take( pl.id_ );

    resp[ "_msgtype" ] = QString();
    resp[ "success" ] = result;

    resp[ "latestrev" ] = pl.revisions.last().revId;

    sendMessage( resp );
}


void
SpotifyResolver::testLoginSucceeded( bool success, const QString& msg )
{
    QVariantMap m;
    m[ "qid" ] = m_checkLoginQid;
    m[ "success" ] = success;
    m[ "message" ] = msg;

    m_checkLoginQid.clear();
    sendMessage( m );
}

void
SpotifyResolver::notifyAllPlaylistsLoaded()
{
    qDebug() << Q_FUNC_INFO << "Sending all spotify playlists, found:" << m_session->Playlists()->getPlaylists().size();
    // Send a list of all the users's playlists and sync states
    QVariantMap msg;
    msg[ "_msgtype" ] = "allPlaylists";
    QVariantList playlists;
    foreach ( const SpotifyPlaylists::LoadedPlaylist& pl, m_session->Playlists()->getPlaylists() )
    {
        QVariantMap plObj;
        plObj[ "name" ] = pl.name_;
        plObj[ "id" ] = pl.id_;
        if( pl.revisions.isEmpty() )
        {
            qDebug() << "Revisions was empty";
            continue;
        }
        plObj[ "revid" ] = pl.revisions.last().revId;
        plObj[ "sync" ] = pl.sync_;
        playlists << plObj;
    }
    msg[ "playlists" ] = playlists;
//     qDebug() << "ALL" << playlists;

    sendMessage( msg );
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
    else if ( m.value( "_msgtype" ) == "quit" )
    {
        quit();
    }
    else if( m.value( "_msgtype" ) == "checkLogin" )
    {
        const QString username = m[ "username" ].toString();
        const QString pw = m[ "password" ].toString();

        m_checkLoginQid = m[ "qid" ].toString();

        // Test with the new credentials, and re-log in with previous ones if we were logged in
        m_session->testLogin( username, pw );

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
        // Spotify is sensitive, - equals minus next string, not so good in
        // examples like Queen Breakthru - 2011 remastered == Queen Breaktru ( Does not exist )
        // Also, for some reason, spotify cant find Camelcases at times.
        const QString artist = m.value( "artist" ).toString().replace(" - ", " ").toLower();
        const QString track = m.value( "track" ).toString().replace(" - ", " ").toLower();
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
    else if( m.value( "_msgtype" ) == "getPlaylist" )
    {
        // Asking for playlist and potentially to sync with it. Load it if we have to, and send it over
        const QString plid = m.value( "playlistid" ).toString();
        const bool sync = m.value( "sync" ).toBool();

        const QString qid = m.value( "qid" ).toString();
        if ( !qid.isEmpty() )
            m_playlistToQid[ plid ] = qid;

        qDebug() << Q_FUNC_INFO << "Got request for playlist with sync:" << plid << sync;

        m_session->Playlists()->sendPlaylist( plid, sync );
        SpotifyPlaylists::LoadedPlaylist playlist = m_session->Playlists()->getPlaylist( plid );
    }
    else if ( m.value( "_msgtype" ) == "removeFromSyncList" )
    {
        const QString plid = m.value( "playlistid" ).toString();
//         const QString qid = m.value( "qid" ).toString();

        m_session->Playlists()->setSyncPlaylist( plid, false );
    }
    else if ( m.value( "_msgtype" ) == "removeTracksFromPlaylist" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        const uint oldRev = m.value( "oldrev" ).toUInt();

        const QString qid = m.value( "qid" ).toString();

        if ( plid.isEmpty() )
        {
            qWarning() << "no playlist to remove tracks from! Asked to remove from:" << plid;
            return;
        }

        bool success = m_session->Playlists()->removeFromSpotifyPlaylist( m );
        const int newRev = m_session->Playlists()->getPlaylist( plid ).revisions.last().revId;


        QVariantMap msg;
        msg[ "_msgtype" ] = "";
        msg[ "qid" ] = qid; // ESSENTIAL
        msg[ "success" ] = success;
        msg[ "newrev" ] = newRev;
        sendMessage( msg );
    }
    else if ( m.value( "_msgtype" ) == "addTracksToPlaylist" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        const uint oldRev = m.value( "oldrev" ).toUInt();
        const int startPos = m.value( "startPosition" ).toInt();

        const QString qid = m.value( "qid" ).toString();
        if ( !qid.isEmpty() )
            m_playlistToQid[ plid ] = qid;

        if ( plid.isEmpty() )
        {
            qWarning() << "no playlist to add tracks to! Asked to add to:" << plid;
            return;
        }

        m_session->Playlists()->addTracksToSpotifyPlaylist( m );

        // callback is async
    }
}


void
SpotifyResolver::addTracksToPlaylist( const QString plid, const QString oldRev, QVariantMap tracks, const int pos )
{

    qDebug() << Q_FUNC_INFO;
    SpotifyPlaylists::LoadedPlaylist playlist = m_session->Playlists()->getPlaylistByRevision( oldRev.toInt() );
    if( !playlist.id_.isEmpty() )
    {

    }else
        qDebug() << "Failed to add tracks! for revId" << oldRev.toInt();

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
#if SPOTIFY_API_VERSION >= 11
    sp_search_create( m_session->Session(), query.toUtf8().data(), 0, data->fulltext ? 50 : 1, 0, 0, 0, 0, 0, 0, SP_SEARCH_STANDARD, &SpotifySearch::searchComplete, data );
#else
    sp_search_create( m_session->Session(), query.toUtf8().data(), 0, data->fulltext ? 50 : 1, 0, 0, 0, 0, &SpotifySearch::searchComplete, data );
#endif
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

QVariantMap
SpotifyResolver::spTrackToVariant( sp_track* tr )
{
    QVariantMap track;
    track[ "track" ] = QString::fromUtf8( sp_track_name( tr ) );

    sp_artist* artist = sp_track_artist( tr, 0 );
    if ( sp_artist_is_loaded( artist ) )
        track[ "artist" ] = QString::fromUtf8( sp_artist_name( artist ) );

    sp_album* album = sp_track_album( tr );
    if ( sp_album_is_loaded( album ) )
        track[ "album" ] = QString::fromUtf8( sp_album_name( album ) );

    sp_link* l = sp_link_create_from_track( tr, 0 );
    char urlStr[256];
    sp_link_as_string( l, urlStr, sizeof(urlStr) );
    track[ "id" ] = QString::fromAscii( urlStr );
    sp_link_release( l );

    return track;
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
