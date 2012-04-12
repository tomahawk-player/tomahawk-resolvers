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
   , m_username( QString() )
   , m_password ( QString() )
   , m_oldUsername( QString() )
   , m_testLogin( false )
{

    // Instance
    s_instance = this;
    // Friends
    m_SpotifyPlaylists = new SpotifyPlaylists( this );
    connect( m_SpotifyPlaylists, SIGNAL( sendLoadedPlaylist( SpotifyPlaylists::LoadedPlaylist ) ), this, SLOT(playlistReceived(SpotifyPlaylists::LoadedPlaylist) ) );

    m_SpotifyPlaylists->moveToThread( &m_playlistThread );
    m_playlistThread.start( QThread::LowPriority );
    m_SpotifyPlayback = new SpotifyPlayback;

    // Connect to signals
    connect( this, SIGNAL( notifyMainThreadSignal() ), this, SLOT( notifyMainThread() ), Qt::QueuedConnection );

    if(!config.application_key.isEmpty() || config.g_app_key != NULL) {

        m_config.api_version = SPOTIFY_API_VERSION;
        m_config.cache_location = config.cache_location;
        m_config.settings_location = config.settings_location;
        m_config.application_key = ( config.application_key.isEmpty() ? config.g_app_key : config.application_key);
        m_config.application_key_size = config.application_key_size;
        m_config.user_agent = config.user_agent;
        m_config.callbacks = &SpotifyCallbacks::callbacks;
        m_config.tracefile = config.tracefile;
        m_config.device_id = config.device_id;
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

SpotifySession*
SpotifySession::getInstance()
{
    return s_instance;
}

SpotifySession::~SpotifySession(){

    qDebug() << "Destroy session";
    delete m_SpotifyPlaylists;
    delete m_SpotifyPlayback;
    sp_playlistcontainer_remove_callbacks( m_container, &SpotifyCallbacks::containerCallbacks, this);
    if( m_session != NULL )
    {
        qDebug() << "Destroying m_session";
        sp_session_logout( m_session );
        sp_session_release( m_session );
    }


}

void SpotifySession::loggedIn(sp_session *session, sp_error error)
{
   SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));

   if (_session->m_testLogin)
   {
       _session->m_testLogin = false;
       emit _session->testLoginSucceeded( error == SP_ERROR_OK, QString::fromAscii( sp_error_message( error ) ) );

       if (_session->m_loggedInBeforeTest)
       {
           _session->m_loggedInBeforeTest = false;
           // We were logged in and then did a test login, re-log in with our old credentials.
           _session->login();
       }
    }
    if (error == SP_ERROR_OK) {

        qDebug() << "Logged in successfully!!";

        _session->setSession(session);
        _session->setLoggedIn(true);

        qDebug() << "Container called from thread" << _session->thread()->currentThreadId();

        sp_playlistcontainer_add_callbacks(
                sp_session_playlistcontainer(session),
                &SpotifyCallbacks::containerCallbacks, _session);

        emit _session->notifyLoggedInSignal();

        return;
    }
    qDebug() << Q_FUNC_INFO << "==== " << sp_error_message( error ) << " ====";
    _session->sendErrorMsg( error );
}

void SpotifySession::clearOldUserdata()
{
   m_SpotifyPlaylists->unsetAllLoaded();
}

void SpotifySession::testLogin(const QString& username, const QString& pw)
{
    qDebug() << "Testing login with username:" << username;
    m_testLogin = true;
    m_loggedInBeforeTest = true;
    sp_session_logout(m_session);
#if SPOTIFY_API_VERSION >= 11
    sp_session_login(m_session, username.toLatin1(), pw.toLatin1(), false, NULL);
#else
    sp_session_login(m_session, username.toLatin1(), pw.toLatin1(), false);
#endif
}

void SpotifySession::setCredentials(QString username, QString password)
{
    m_username = username;
    m_password = password;
}

void SpotifySession::login()
{
    qDebug() << Q_FUNC_INFO;

    if( !m_username.isEmpty() && !m_password.isEmpty() )
    {
        if( m_oldUsername.isEmpty() )
            m_oldUsername = m_username;
        else if( m_username != m_oldUsername )
        {
            m_oldUsername = m_username;
            clearOldUserdata();
        }

        qDebug() << "Logging in with username:" << m_username;
#if SPOTIFY_API_VERSION >= 11
        sp_session_login(m_session, m_username.toLatin1(), m_password.toLatin1(), false, NULL);
#else
        sp_session_login(m_session, m_username.toLatin1(), m_password.toLatin1(), false);
#endif
    }
    else
        qDebug() << "No username or password provided!";
}

void SpotifySession::sendNotifyLoggedInSignal()
{
    emit notifyLoggedInSignal();
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
    Q_UNUSED( session );
    qDebug() << "Logging out";

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

