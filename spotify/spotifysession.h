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

#ifndef SPOTIFYSESSION_H
#define SPOTIFYSESSION_H

#include <QObject>
#include <QCoreApplication>
#include <QDebug>
#include <QThread>
#include <QTimer>
#include <QString>
#include <QThread>
#include <libspotify/api.h>
#include "spotifyplayback.h"
#include "spotifyplaylists.h"

/**
    sessionConfig
        This is used to be passed to SpotifySession, as a substitute to sp_session_config
        It will set the config for the session
        If you first set sp_session_config and pass it to this
        it will not work as intended with callbacks.
**/
typedef struct
{
    QByteArray cache_location;
    QByteArray settings_location;
    QByteArray user_agent;
    QByteArray tracefile;
    QByteArray device_id;
    QByteArray application_key;
    // Use if your appkey isnt encrypted
    const void *g_app_key;
    size_t application_key_size;


} sessionConfig;

class SpotifySession : public QObject
{
    Q_OBJECT
public:

    explicit SpotifySession( sessionConfig config, QObject *parent = 0 );
    virtual ~SpotifySession();
    static SpotifySession* getInstance();

    // Mainthread
    void sendNotifyThreadSignal();

    // Session functions
    void setSession(sp_session* session){ m_session = session; }
    sp_session* Session() const { return m_session; }
    sp_session_config getSessionConfig() { return m_config; }
    //  Login
    void setLoggedIn( bool loggedIn ){ m_loggedIn = loggedIn; }
    bool isLoggedIn(){ return m_loggedIn;}
    void login( const QString& username, const QString& password, const QByteArray &blob = NULL );
    void logout( bool clearPlaylists );

    // Playlists
    void setPlaylistContainer( sp_playlistcontainer *pc){ m_container = pc; }
    void setPlaylistContainerLoaded( bool loaded ){ m_pcLoaded = loaded; }
    bool isPlaylistContainerLoaded() const { return m_pcLoaded; }
    sp_playlistcontainer* PlaylistContainer() const { return m_container; }
    SpotifyPlaylists* Playlists() { return m_SpotifyPlaylists; }

    // Playback
    SpotifyPlayback* Playback() { return m_SpotifyPlayback; }

    // Spotify session callbacks.
    static void SP_CALLCONV loggedIn(sp_session *session, sp_error error);
    static void SP_CALLCONV loggedOut(sp_session *session);
    static void SP_CALLCONV connectionError(sp_session *session, sp_error error);
    static void SP_CALLCONV notifyMainThread(sp_session *session);
    static void SP_CALLCONV logMessage(sp_session *session, const char *data);
    static void SP_CALLCONV credentialsBlobUpdated(sp_session *session, const char *blob);

    // Error
    void doSendErrorMsg( const QString &msg, bool isDebug){ emit sendErrorMsg( msg, isDebug); }
    bool m_relogin;
signals:
    void notifyMainThreadSignal();
    void loginResponse( bool success, const QString& response );
    void notifySyncUpdateSignal( const SpotifyPlaylists::LoadedPlaylist& playlist );
    void sendErrorMsg( sp_error );
    void sendErrorMsg( const QString &msg, bool isDebug );
    void userChanged();
    void blobUpdated( const QByteArray& username, const QByteArray& blob);
    void notifyLoggedin();
public slots:
    void playlistReceived( const SpotifyPlaylists::LoadedPlaylist& playlist);

private slots:
    void notifyMainThread();
    void relogin();
private:
    void createSession();
    // When username changed, clear old users data
    void clearOldUserdata();

    // Mixed
    static SpotifySession* s_instance;
    SpotifyPlaylists *m_SpotifyPlaylists;
    SpotifyPlayback *m_SpotifyPlayback;
    sp_playlistcontainer *m_container;
    bool m_pcLoaded;
    sessionConfig m_sessionConfig;

    // Session
    sp_session_config m_config;
    sp_session *m_session;
    bool m_loggedIn;

    // Login
    QString m_username;
    QString m_password;
    QString qid;



};

#endif // SPOTIFYSESSION_H
