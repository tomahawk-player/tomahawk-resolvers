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
    , m_ignoreNextUpdate( false )
{
    setOrganizationName( QLatin1String( "TomahawkSpotify" ) );
    setOrganizationDomain( QLatin1String( "tomahawk-player.org" ) );
    setApplicationName( QLatin1String( "SpotifyResolver" ) );
    setApplicationVersion( QLatin1String( "2.0" ) );

}

SpotifyResolver::~SpotifyResolver()
{
    qDebug() << "exiting...";
    clearTrackLinkMap();

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
    connect( m_session, SIGNAL( loginResponse( bool, QString ) ), this, SLOT( loginResponse( bool, QString ) ) );
    connect( m_session, SIGNAL( userChanged() ), this, SLOT( userChangedReceived() ) );
    connect( m_session, SIGNAL( sendErrorMsg( sp_error ) ), this, SLOT( errorMsgReceived( sp_error ) ) );
    connect( m_session, SIGNAL( blobUpdated(const QByteArray,const QByteArray) ), this, SLOT( updateBlob(const QByteArray, const QByteArray) ) );
    connect( m_session, SIGNAL( sendErrorMsg( QString, bool ) ), this, SLOT( errorMsgReceived( QString, bool ) ) );
    connect( m_session, SIGNAL( notifyLoggedin() ), this, SLOT( notifyAllPlaylistsLoaded() ) );

    // Signals
    connect( m_session, SIGNAL(notifySyncUpdateSignal(SpotifyPlaylists::LoadedPlaylist) ), this, SLOT( sendPlaylist(SpotifyPlaylists::LoadedPlaylist) ) );

    connect( m_session->Playlists(), SIGNAL(sendTracksAdded(sp_playlist*,QList<sp_track*>,QString)), this, SLOT(sendTracksAdded(sp_playlist*,QList<sp_track*>,QString)));
    connect( m_session->Playlists(), SIGNAL(sendTracksMoved(sp_playlist*,QStringList,QString)), this, SLOT(sendTracksMoved(sp_playlist*,QStringList,QString)));
    connect( m_session->Playlists(), SIGNAL(sendTracksRemoved(sp_playlist*,QStringList)), this, SLOT(sendTracksRemoved(sp_playlist*,QStringList)));
    connect( m_session->Playlists(), SIGNAL(sendPlaylistDeleted(QString)), this, SLOT(sendPlaylistDeleted(QString)));
    connect( m_session->Playlists(), SIGNAL(notifyNameChange(SpotifyPlaylists::LoadedPlaylist)), this, SLOT( sendPlaylistNameChanged(SpotifyPlaylists::LoadedPlaylist) ));
    connect( m_session->Playlists(), SIGNAL( notifyContainerLoadedSignal() ), this, SLOT( notifyAllPlaylistsLoaded() ) );

    // read stdin
    m_stdinWatcher = new ConsoleWatcher( 0 );
    connect( m_stdinWatcher, SIGNAL( lineRead( QVariant ) ), this, SLOT( playdarMessage( QVariant ) ) );
    m_stdinWatcher->moveToThread( &m_stdinThread );
    m_stdinThread.start( QThread::LowPriority );
}

void SpotifyResolver::errorMsgReceived(sp_error error)
{
    QString errMsg;
    bool debugMsg( false );
    switch (error) {
        case SP_ERROR_BAD_API_VERSION:
        case SP_ERROR_API_INITIALIZATION_FAILED:
        case SP_ERROR_BAD_APPLICATION_KEY:
        case SP_ERROR_CLIENT_TOO_OLD:
        case SP_ERROR_BAD_USER_AGENT:
        case SP_ERROR_MISSING_CALLBACK:
        case SP_ERROR_INVALID_INDATA:
        case SP_ERROR_INDEX_OUT_OF_RANGE:
        case SP_ERROR_OTHER_TRANSIENT:
        case SP_ERROR_IS_LOADING:
            debugMsg = true;
            errMsg = QString("An internal error happened with error code (%1).\n\nPlease, report this bug." ).arg(error);
            break;
        case SP_ERROR_BAD_USERNAME_OR_PASSWORD:
            errMsg =  "Invalid username or password";
            break;
        case SP_ERROR_USER_BANNED:
            errMsg =  "This user has been banned";
            break;
        case SP_ERROR_UNABLE_TO_CONTACT_SERVER:
            errMsg =  "Cannot connect to server";
            break;
        case SP_ERROR_OTHER_PERMANENT:
            debugMsg = true;
            errMsg =  "A permanent error occured";
            break;
        case SP_ERROR_USER_NEEDS_PREMIUM:
            errMsg = "You need to be a Premium User in order to login";
            break;
        default:
            debugMsg = true;
            errMsg =  QString::fromUtf8( sp_error_message( error ) );
            break;
    }
    errorMsgReceived( errMsg, debugMsg );
}

void SpotifyResolver::updateBlob(const QByteArray& username, const QByteArray& blob)
{
    if( m_username == QString(username) )
    {
        QSettings s;
        s.setValue( m_username+"/blob", QString(blob) );
    }
    else
        qDebug() << "===== FAILED TO SAVE BLOB";
}

void SpotifyResolver::errorMsgReceived( const QString &errMsg, bool isDebug )
{
    QVariantMap resp;
    resp[ "_msgtype" ] = "spotifyError";
    resp[ "msg" ] = errMsg;
    resp[ "isDebugMsg" ] = isDebug;
    QJson::Serializer s;
    QByteArray msg = s.serialize( resp );
    qDebug() << "SENDING ERROR JSON:" << msg;
    sendMessage( resp );
}

void SpotifyResolver::userChangedReceived()
{

    QVariantMap resp;
    resp[ "_msgtype" ] = "userChanged";
    resp[ "msg" ] = "Username changed! Removing synced playlists...";
    sendMessage( resp );

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

void SpotifyResolver::sendPlaylistNameChanged( const SpotifyPlaylists::LoadedPlaylist &pl )
{
    qDebug() << "Sending playlist namechange to client:" << pl.name_;

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
    resp[ "_msgtype" ] = "playlistRenamed";

    QJson::Serializer s;
    QByteArray msg = s.serialize( resp );
    qDebug() << "SENDING PLAYLIST JSON:" << msg;

    sendMessage( resp );
}

void
SpotifyResolver::sendTracksAdded( sp_playlist* pl, const QList< sp_track* >& tracks, const QString& positionId )
{
    QVariantMap msg;
    msg[ "_msgtype" ] = "tracksAdded";

    SpotifyPlaylists::LoadedPlaylist lpl = m_session->Playlists()->getLoadedPlaylist( pl );

    QString oldrev;
    if ( lpl.revisions.size() >= 2 )
        oldrev = lpl.revisions.at( lpl.revisions.size() - 2 ).revId;

    msg[ "playlistid" ] = lpl.id_;
    msg[ "oldrev" ] = oldrev;
    msg[ "revid" ] = lpl.revisions.last().revId;
    msg[ "startPosition" ] = positionId;

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

    QJson::Serializer s;
    QByteArray m = s.serialize( msg );
    qDebug() << "SENDING ADDED TRACKS JSON:" << m;

    sendMessage( msg );
}


void
SpotifyResolver::sendTracksMoved( sp_playlist* pl, const QStringList& tracks, const QString& positionId )
{
    // TODO
    QVariantMap msg;
    msg[ "_msgtype" ] = "tracksMoved";

    SpotifyPlaylists::LoadedPlaylist lpl = m_session->Playlists()->getLoadedPlaylist( pl );

    QString oldrev;
    if ( lpl.revisions.size() >= 2 )
        oldrev = lpl.revisions.at( lpl.revisions.size() - 2 ).revId;

    msg[ "playlistid" ] = lpl.id_;
    msg[ "oldrev" ] = oldrev;
    msg[ "revid" ] = lpl.revisions.last().revId;
    msg[ "newStartPosition" ] = positionId;

    QVariantList v; // ARGGG i hate qjson. QStringList encodes [ "a" ]  as "a" instead of [ "a" ].
    foreach( const QString& str, tracks )
        v << str;

    msg[ "tracks" ] = v;

    QJson::Serializer s;
    QByteArray m = s.serialize( msg );
    qDebug() << "SENDING MOVED TRACKS JSON:" << m;

    sendMessage( msg );
}


void
SpotifyResolver::sendTracksRemoved( sp_playlist* pl, const QStringList& tracks )
{
    QVariantMap msg;
    msg[ "_msgtype" ] = "tracksRemoved";

    SpotifyPlaylists::LoadedPlaylist lpl = m_session->Playlists()->getLoadedPlaylist( pl );

    QString oldrev("");
    if ( lpl.revisions.size() >= 2 )
        oldrev = lpl.revisions.at( lpl.revisions.size() - 2 ).revId;

    msg[ "playlistid" ] = lpl.id_;
    msg[ "oldrev" ] = oldrev;
    msg[ "revid" ] = lpl.revisions.last().revId;

    QVariantList v; // ARGGG i hate qjson. QStringList encodes [ "a" ]  as "a" instead of [ "a" ].
    foreach( const QString& str, tracks )
        v << str;

    msg[ "trackPositions" ] = v;

    QJson::Serializer s;
    QByteArray m = s.serialize( msg );
    qDebug() << "SENDING TRACKS REMOVED JSON:" << m;

    sendMessage( msg );
}


void
SpotifyResolver::sendPlaylistDeleted( const QString& playlist )
{
    QVariantMap msg;
    msg[ "_msgtype" ] = "playlistDeleted";
    msg[ "playlistid" ] = playlist;

    QJson::Serializer s;
    QByteArray m = s.serialize( msg );
    qDebug() << "SENDING PLAYLIST REMOVED JSON:" << m;

    sendMessage( msg );
}


void
SpotifyResolver::sendAddTracksResult( const QString& spotifyId, QList<int> tracksInserted, QList<QString> insertedIds, bool result )
{
    QVariantMap resp;
    SpotifyPlaylists::LoadedPlaylist pl = m_session->Playlists()->getPlaylist( spotifyId );

    if ( m_playlistToQid.contains( pl.id_ ) )
        resp[ "qid" ] = m_playlistToQid.take( pl.id_ );

    resp[ "_msgtype" ] = QString();
    resp[ "success" ] = result;

    resp[ "latestrev" ] = pl.revisions.last().revId;
    resp[ "playlistid" ] = spotifyId;

    QVariantList ins;
    foreach ( int i, tracksInserted )
        ins << i;
    resp[ "trackPosInserted" ] = ins;

    QVariantList ids;
    foreach ( QString id, insertedIds )
        ids << id;

    resp[ "trackIdInserted" ] = ids;

    QJson::Serializer s;

    QByteArray m = s.serialize( resp );
    qDebug() << "SENDING ADD TRACKS RESULT JSON:" << m;

    sendMessage( resp );
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
        plObj[ "collaborative" ] = pl.isCollaborative;
        plObj[ "subscribed" ] = pl.isSubscribed;
        plObj[ "owner" ] = pl.owner_;
        playlists << plObj;
    }
    msg[ "playlists" ] = playlists;
//     qDebug() << "ALL" << playlists;

    QJson::Serializer s;
    QByteArray m = s.serialize( msg );
    qDebug() << "SENDING ALL PLAYLISTS JSON:" << m;

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

    login();

    // testing
//     search( "123", "coldplay", "the scientist" );
}

void SpotifyResolver::loginResponse( bool success , const QString& msg)
{
    qDebug() << Q_FUNC_INFO << "Notified of login response, sending to client:" << success << msg;
    m_loggedIn = true;

    QVariantMap resp;
    resp[ "_msgtype" ] = "loginResponse";
    resp[ "success" ] = success;
    resp[ "message" ] = msg;
    resp[ "username" ] = m_username;
    resp[ "password" ] = m_pw;
    resp[ "highQuality" ] = m_highQuality;
    sendMessage( resp );

    sendSettingsMessage();
    sp_session_preferred_bitrate( m_session->Session(), m_highQuality ? SP_BITRATE_320k : SP_BITRATE_160k );
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


    if( m.value( "_msgtype" ) == "login" )
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
    else if ( m.value( "_msgtype" ) == "getCredentials" )
    {
        // For migrating to tomahawk accounts
        qDebug() << "Tomahawk asked for credentials, sending!";
        QVariantMap msg;

        msg[ "_msgtype" ] = "credentials";
        msg[ "username" ] = m_username;
        msg[ "password" ] = (m_pw.isEmpty() ? "*****" : m_pw); // Placeholder for remembered user
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
    else if( m.value( "_msgtype" ) == "getPlaylist" )
    {
        // Asking for playlist and potentially to sync with it. Load it if we have to, and send it over
        const QString plid = m.value( "playlistid" ).toString();
        const bool sync = m.value( "sync" ).toBool();

        const QString qid = m.value( "qid" ).toString();
        registerQidForPlaylist( qid, plid );

        qDebug() << Q_FUNC_INFO << "Got request for playlist with sync:" << plid << sync;

        m_session->Playlists()->sendPlaylist( plid, sync );
        //SpotifyPlaylists::LoadedPlaylist playlist = m_session->Playlists()->getPlaylist( plid );
    }
    else if ( m.value( "_msgtype" ) == "removeFromSyncList" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        m_session->Playlists()->setSyncPlaylist( plid, false );
    }
    else if ( m.value( "_msgtype" ) == "setCollaborative" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        const bool collab = m.value( "collaborative" ).toBool();
        m_session->Playlists()->setCollaborative( plid, collab );
    }
    else if ( m.value( "_msgtype" ) == "setSubscription" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        const bool collab = m.value( "subscribe" ).toBool();
        m_session->Playlists()->addSubscribedPlaylist( plid );
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
        const QString newRev = m_session->Playlists()->getPlaylist( plid ).revisions.last().revId;


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

        const QString qid = m.value( "qid" ).toString();
        registerQidForPlaylist( qid, plid );

        if ( plid.isEmpty() )
        {
            qWarning() << "no playlist to add tracks to! Asked to add to:" << plid;
            return;
        }

        m_session->Playlists()->addTracksToSpotifyPlaylist( m );

        // callback is async
    }
    else if ( m.value( "_msgtype" ) == "moveTracksInPlaylist" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        const uint oldRev = m.value( "oldrev" ).toUInt();
        const QString startPos = m.value( "startPosition" ).toString();

        const QString qid = m.value( "qid" ).toString();

        if ( plid.isEmpty() )
        {
            qWarning() << "no playlist to move tracks in! Asked to move in:" << plid;
            return;
        }
        const QVariantList tracks = m.value( "tracks" ).toList();

        sp_error ret = m_session->Playlists()->moveTracksInSpotifyPlaylist( plid, tracks, startPos );

        const QString newRev = m_session->Playlists()->getPlaylist( plid ).revisions.last().revId;
        const bool success = (ret == SP_ERROR_OK);

        QVariantMap resp;
        resp[ "_msgtype" ] = "";
        resp[ "qid" ] = qid;
        resp[ "success" ] = success;
        resp[ "playlistid" ] = plid;
        resp[ "newrev" ] = newRev;


        QJson::Serializer s;
        QByteArray mm = s.serialize( resp );
        qDebug() << "SENDING MOVED TRACKS RESPONSE JSON:" << mm;

        sendMessage( resp );
    }
    else if( m.value( "_msgtype" ) == "playlistRenamed")
    {
        // Important oldrev
        if( !m.value( "oldrev" ).isValid() )
        {
            qWarning() << "No revision id for namechange!";
            return;
        }
        const QString plid = m.value( "playlistid" ).toString();
        const QString newTitle = m.value( "newTitle" ).toString();
        const QString oldTitle = m.value( "oldTitle" ).toString();

        if ( plid.isEmpty() )
        {
            qWarning() << "no playlist to add tracks to! Asked to add to:" << plid;
            return;
        }

        if( newTitle.isEmpty() || oldTitle.isEmpty() )
        {
            qWarning() << "Cant rename playlist with empty name!";
            return;
        }

        m_session->Playlists()->renamePlaylist( m );
    }
    else if ( m.value( "_msgtype" ) == "createPlaylist" )
    {
        m_session->Playlists()->addNewPlaylist( m );
    }
    else if ( m.value( "_msgtype" ) == "deletePlaylist" )
    {
        const QString plid = m.value( "playlistid" ).toString();
        sp_playlist* pl = m_session->Playlists()->getPlaylist( plid ).playlist_;
        if ( pl )
            m_session->Playlists()->doRemovePlaylist( pl );
    }
}


void
SpotifyResolver::registerQidForPlaylist( const QString& qid, const QString& playlist )
{
    if ( !qid.isEmpty() )
        m_playlistToQid[ playlist ] = qid;

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
    sp_search_create( m_session->Session(), query.toUtf8().data(), 0, data->fulltext ? 50 : 5, 0, 0, 0, 0, 0, 0, SP_SEARCH_STANDARD, &SpotifySearch::searchComplete, data );
#else
    sp_search_create( m_session->Session(), query.toUtf8().data(), 0, data->fulltext ? 50 : 1, 0, 0, 0, 0, &SpotifySearch::searchComplete, data );
#endif
}

QString SpotifyResolver::addToTrackLinkMap(sp_link* link)
{
    char url[1024];
    sp_link_as_string( link, url, sizeof( url ) );

    QString uid = url;

    if ( !m_trackLinkMap.contains( uid ) )
    {
        sp_link_add_ref( link );
        m_trackLinkMap.insert( uid, link );
    }

    return uid;
}

sp_link* SpotifyResolver::linkFromTrack(const QString& uid)
{
    if ( sp_link* l = m_trackLinkMap.value( uid, 0 ) )
        return l;

    if ( uid.startsWith( "spotify:track" ) )
    {
        sp_link* l = sp_link_create_from_string( uid.toAscii() );
        m_trackLinkMap[ uid ] = l;
        return l;
    }
    return 0;
}

void SpotifyResolver::clearTrackLinkMap()
{
    QHash<QString, sp_link*>::iterator i = m_trackLinkMap.begin();
    while ( i != m_trackLinkMap.end() )
    {
        sp_link_release( i.value() );
        i = m_trackLinkMap.erase( i );
    }
}

void SpotifyResolver::removeFromTrackLinkMap(const QString& linkStr)
{
    sp_link_release( m_trackLinkMap.take( linkStr ) );
}

bool SpotifyResolver::hasLinkFromTrack(const QString& linkStr)
{
    if( m_trackLinkMap.contains( linkStr ) )
        return true;

    sp_link *test_link = sp_link_create_from_string( linkStr.toAscii() );
    if( test_link == NULL ){
        return false;
    }
    if( sp_link_type( test_link ) == SP_LINKTYPE_TRACK ){
        sp_link_release( test_link );
        return true;
    }
    sp_link_release( test_link );
    return false;
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
    track[ "id" ] = QString::fromUtf8( urlStr );
    sp_link_release( l );

    return track;
}

/// misc stuff

void SpotifyResolver::loadSettings()
{
    QSettings s;
    m_username = s.value( "username", QString() ).toString();
    m_blob = s.value( m_username+"/blob", QByteArray() ).toByteArray();
    //WIP - Remembered user
    //m_pw = s.value( "password", QString() ).toString();
    m_highQuality = s.value( "highQualityStreaming", true ).toBool();
}

void SpotifyResolver::saveSettings() const
{
    QSettings s;
    s.setValue( "username", m_username );
    //WIP - Remembered user
    //s.setValue( "password", m_pw );
    s.setValue( "highQualityStreaming", m_highQuality );
}

void SpotifyResolver::login()
{
    if( !m_username.isEmpty() ) { // log in
        qDebug() << "Logging in with username:" << m_username;
        m_session->login( m_username, m_pw, m_blob );
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

    path += QDir::separator() + QCoreApplication::applicationName();
    QDir d( path );
    d.mkpath( path );

    //qDebug() << "Using SpotifyResolver data dir:" << path;
    return path;
}

void
SpotifyResolver::instanceStarted( KDSingleApplicationGuard::Instance )
{
    // well goodbye!
    qApp->quit();
}
