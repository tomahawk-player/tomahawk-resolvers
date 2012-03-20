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
//#include "spotifyhttpserver.h"
#include "spotifyplaylists.h"
#include "spotifyplayback.h"
#include <QCoreApplication>
#include <libspotify/api.h>
#include "callbacks.h"
#include "appkey.h"
#include <QDebug>
#include <QThread>
#include <QTimer>
#include <QString>
#include <QThread>

SpotifySession* SpotifySession::s_instance = 0;

SpotifySession::SpotifySession( sessionConfig config, QObject *parent )
   : QObject( parent )
   , m_pcLoaded( false )
   , m_username( "" )
   , m_password ( "" )
   , m_testLogin( false )
{

    // Set applicationName
    // @note: this is needed for setting syncflags and keep them on shutdown.
    // sure it can be combined with the resolver better
    /*QCoreApplication::setOrganizationName("org.SpotifyApi");
    QCoreApplication::setOrganizationDomain("spotifyapi-git");
    QCoreApplication::setApplicationName("SpotifyApi");*/

    // Instance
    s_instance = this;

    // Friends
    m_SpotifyPlaylists = new SpotifyPlaylists;
    connect( m_SpotifyPlaylists, SIGNAL(send(SpotifyPlaylists::LoadedPlaylist)), this, SLOT(get(SpotifyPlaylists::LoadedPlaylist)) );
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
    sp_session_logout( m_session );


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

    /// Clear old list
    /// @todo: if sp_username != oldUsername!
    /*if( _session->Playlists()->getPlaylists().size() != 0){

        for ( int i = 0 ; i < sp_playlistcontainer_num_playlists( SpotifySession::getInstance()->PlaylistContainer() ) ; ++i )
        {
            sp_playlist* playlist = sp_playlistcontainer_playlist( SpotifySession::getInstance()->PlaylistContainer(), i );
            qDebug() << "Remvoing callbacks on " << sp_playlist_name( playlist );
            sp_playlist_remove_callbacks( playlist, &SpotifyCallbacks::playlistCallbacks, SpotifySession::getInstance()->Playlists() );
            if( i < _session->Playlists()->getPlaylists().size() )
            {
                sp_playlist_release( _session->Playlists()->getPlaylists()[i].playlist_ );
            }

        }
        _session->Playlists()->unsetAllLoaded();
        _session->Playlists()->getPlaylists().clear();

    }*/

     sp_playlistcontainer_add_callbacks(
            sp_session_playlistcontainer(session),
            &SpotifyCallbacks::containerCallbacks, _session);

    emit _session->notifyLoggedInSignal();

    return;
    }

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
            qDebug() << QString("An internal error happened with error code (%1).\n\nPlease, report this bug." ).arg(error);
            break;
        case SP_ERROR_BAD_USERNAME_OR_PASSWORD:
            qDebug() << "Invalid username or password";
            break;
        case SP_ERROR_USER_BANNED:
            qDebug() << "This user has been banned";
            break;
        case SP_ERROR_UNABLE_TO_CONTACT_SERVER:
            qDebug() << "Cannot connect to server";
            break;
        case SP_ERROR_OTHER_PERMANENT:
            qDebug() << "Something wrong happened.\n\nWhatever it is, it is permanent.";
            break;
        case SP_ERROR_USER_NEEDS_PREMIUM:
            qDebug() << "You need to be a Premium User in order to login";
            break;
        default:
            qDebug() << "Some other error... wtf?" << sp_error_message( error );
            break;
    }

}

void SpotifySession::testLogin(const QString& username, const QString& pw)
{
    qDebug() << "Testing login with username:" << username;
    m_testLogin = true;
    m_loggedInBeforeTest = true;
    sp_session_logout(m_session);
    sp_session_login(m_session, username.toLatin1(), pw.toLatin1(), false);
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
        qDebug() << "Logging in with username:" << m_username;
        sp_session_login(m_session, m_username.toLatin1(), m_password.toLatin1(), false);
    }
    else
        qDebug() << "No username or password provided!";
}

void SpotifySession::sendNotifyLoggedInSignal()
{
    emit notifyLoggedInSignal();
}


void
SpotifySession::get( SpotifyPlaylists::LoadedPlaylist playlist)
{
    if( playlist.isLoaded && playlist.sync_ )
    {
        qDebug() << "Received sync: " << playlist.id_ << sp_playlist_name( playlist.playlist_);
        emit notifySyncUpdateSignal( playlist );
    }

    else if( playlist.isLoaded && playlist.starContainer_ )
    {
        qDebug() << "Received starred: " << playlist.id_ << sp_playlist_name( playlist.playlist_);
        emit notifyStarredUpdateSignal( playlist );
    }

}

void SpotifySession::sendNotifyThreadSignal()
{

    emit notifyMainThreadSignal();
}



void SpotifySession::notifyMainThread()
{
    int timeout(0);
    do {
        sp_session_process_events( m_session, &timeout );
    } while( !timeout );

    QTimer::singleShot( timeout, this, SLOT( notifyMainThread() ) );
}

