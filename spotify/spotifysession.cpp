/**  This file is part of QT SpotifyWebApi - <hugolm84@gmail.com> ===
 *
 *   Copyright 2011-2012,Hugo Lindström <hugolm84@gmail.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 */

#include "spotifysession.h"
#include "callbacks.h"

SpotifySession* SpotifySession::s_instance = 0;

SpotifySession::SpotifySession( sessionConfig config, QObject *parent )
   : QObject( parent )
   , m_pcLoaded( false )
   , m_sessionConfig( config )
   , m_loggedIn( false )
   , m_relogin( false )
{

    // Instance
    s_instance = this;
    // Friends
    m_SpotifyPlaylists = new SpotifyPlaylists( this );
    connect( m_SpotifyPlaylists, SIGNAL( sendLoadedPlaylist( SpotifyPlaylists::LoadedPlaylist ) ), this, SLOT(playlistReceived(SpotifyPlaylists::LoadedPlaylist) ) );
    // Playlist cachemiss fix
    connect( m_SpotifyPlaylists, SIGNAL( forcePruneCache() ), this, SLOT( relogin() ) );
    m_SpotifyPlayback = new SpotifyPlayback( this );

    // Connect to signals
    connect( this, SIGNAL( notifyMainThreadSignal() ), this, SLOT( notifyMainThread() ), Qt::QueuedConnection );

    createSession();
}

SpotifySession*
SpotifySession::getInstance()
{
    return s_instance;
}

SpotifySession::~SpotifySession(){

    qDebug() << "Destroy session";
    logout( false ); // Make sure to not clear playlists here. ~SpotifyPlaylists() will also call clear() which will save config

}


void SpotifySession::createSession()
{
    m_config = sp_session_config();

    if(!m_sessionConfig.application_key.isEmpty() || m_sessionConfig.g_app_key != NULL) {

        m_config.api_version = SPOTIFY_API_VERSION;
        m_config.cache_location = m_sessionConfig.cache_location;
        m_config.settings_location = m_sessionConfig.settings_location;
        m_config.application_key = ( m_sessionConfig.application_key.isEmpty() ? m_sessionConfig.g_app_key : m_sessionConfig.application_key);
        m_config.application_key_size = m_sessionConfig.application_key_size;
        m_config.user_agent = m_sessionConfig.user_agent;
        m_config.callbacks = &SpotifyCallbacks::callbacks;
        m_config.tracefile = m_sessionConfig.tracefile;
        m_config.device_id = m_sessionConfig.device_id;
        m_config.compress_playlists = false;
        m_config.dont_save_metadata_for_playlists = false;
        m_config.initially_unload_playlists = false;

    }
    m_config.userdata = this;
    sp_error err = sp_session_create( &m_config, &m_session );

    if ( SP_ERROR_OK != err )
    {
        qDebug() << "Failed to create spotify session: " << sp_error_message( err );
    }
}


void SpotifySession::loggedIn(sp_session *session, sp_error error)
{
   SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
    if (error == SP_ERROR_OK) {

        qDebug() << "Logged in successfully!!";

        _session->setSession(session);
        _session->setLoggedIn(true);

        qDebug() << "Container called from thread" << _session->thread()->currentThreadId();

        _session->setPlaylistContainer( sp_session_playlistcontainer(session) );
        sp_playlistcontainer_add_ref( _session->PlaylistContainer() );
        sp_playlistcontainer_add_callbacks(_session->PlaylistContainer(), &SpotifyCallbacks::containerCallbacks, _session);
    }
    qDebug() << Q_FUNC_INFO << "==== " << sp_error_message( error ) << " ====";
    const QString msg = QString::fromUtf8( sp_error_message( error ) );
    emit _session->loginResponse( error == SP_ERROR_OK, msg );
}


void SpotifySession::logout(bool clearPlaylists )
{
    if ( m_loggedIn ) {
        if ( clearPlaylists )
            m_SpotifyPlaylists->unsetAllLoaded();

        sp_playlistcontainer_remove_callbacks( m_container, &SpotifyCallbacks::containerCallbacks, this);
        sp_playlistcontainer_release( m_container );
        sp_session_logout(m_session);
    }

}

void SpotifySession::relogin()
{
    qDebug() << Q_FUNC_INFO;
    if( sp_session_connectionstate(m_session) != SP_CONNECTION_STATE_LOGGED_OUT || m_loggedIn)
    {
        qDebug() << "RElogin";
        delete m_SpotifyPlaylists;
        m_SpotifyPlaylists = new SpotifyPlaylists( this );
        qDebug() << Q_FUNC_INFO << "SpotifySession asked to relog in! Logging out";
        m_relogin = true;
        logout( true );
        return;
    }
}

void SpotifySession::login( const QString& username, const QString& password )
{

    if ( m_loggedIn &&
         m_username == username &&
         m_password == password )
    {
        qDebug() << "Asked to log in with same username and pw that we are already logged in with, ignoring";
        return;
    }

    if( m_username != username && m_loggedIn )
    {
        qDebug() << "We were previously logged in with a different user, so notify client of difference!";
        emit userChanged();
    }

    m_username = username;
    m_password = password;

    if( !m_username.isEmpty() && !m_password.isEmpty() )
    {
        /// @note:  If current state is not logged out, logout this session
        ///         and relogin in callback
        /// @note2: We can be logged out, but the session is still connected to accesspoint
        ///         Wait for that to.
        if( sp_session_connectionstate(m_session) != SP_CONNECTION_STATE_LOGGED_OUT || m_loggedIn)
        {
            qDebug() << Q_FUNC_INFO << "SpotifySession asked to relog in! Logging out";
            m_relogin = true;
            logout( true );
            return;
        }

        qDebug() << Q_FUNC_INFO << "Logging in with username:" << m_username;
#if SPOTIFY_API_VERSION >= 11
        sp_session_login(m_session, m_username.toLatin1(), m_password.toLatin1(), false, NULL);
#else
        sp_session_login(m_session, m_username.toLatin1(), m_password.toLatin1(), false);
#endif
    }
    else
        qDebug() << "No username or password provided!";
}


/// @slot playlistRecieved
/// @note: will only emit if playlist is in syncstate
void
SpotifySession::playlistReceived( const SpotifyPlaylists::LoadedPlaylist& playlist)
{
    if( playlist.isLoaded && playlist.sync_ )
    {
        qDebug() << "Received sync: " << playlist.id_ << sp_playlist_name( playlist.playlist_);
        emit notifySyncUpdateSignal( playlist );
    }
}

/**
  CALLBACKS
  **/
void SpotifySession::loggedOut(sp_session *session)
{
    SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
    _session->setLoggedIn( false );
    qDebug() << "Logging out";

    /// @note: This will login the user after previous user
    ///        was properly logged out.
    if(_session->m_relogin)
    {
        _session->m_relogin = false;
        _session->login( _session->m_username, _session->m_password );
    }


}
void SpotifySession::connectionError(sp_session *session, sp_error error)
{
    Q_UNUSED(session);
    qDebug() << "Connection error: " << QString::fromUtf8(sp_error_message(error));

}
void SpotifySession::notifyMainThread(sp_session *session)
{
    SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
    _session->sendNotifyThreadSignal();
}
void SpotifySession::logMessage(sp_session *session, const char *data)
{
    Q_UNUSED(session);
    qDebug() << "SpotifyLog: " << QString::fromUtf8(data);
}


void SpotifySession::sendNotifyThreadSignal()
{
    emit notifyMainThreadSignal();
}

void SpotifySession::notifyMainThread()
{
    int timeout = 0;
    do {
        sp_session_process_events( m_session, &timeout );
    } while( !timeout );

    QTimer::singleShot( timeout, this, SLOT( notifyMainThread() ) );
}

