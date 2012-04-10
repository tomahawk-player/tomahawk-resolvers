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
#include <libspotify/api.h>
#include <QDebug>
#include "spotifyplayback.h"
#include "spotifyplaylists.h"
//#include "spotifysearch.h"
//#include "consolewatcher.h"
#include <QThread>


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
    // Session functions
    void setSession(sp_session* session){ m_session = session; }
    void sendNotifyThreadSignal();
    void sendNotifyLoggedInSignal();
    void setLoggedIn( bool loggedIn ){ m_loggedIn = loggedIn; }
    void setPlaylistContainer( sp_playlistcontainer *pc){ m_container = pc; }
    void setPlaylistContainerLoaded( bool loaded ){ m_pcLoaded = loaded; }
    void setCredentials(QString username, QString password);
    sp_session* Session() const { return m_session; }
    sp_playlistcontainer* PlaylistContainer() const { return m_container; }
    SpotifyPlaylists* Playlists() { return m_SpotifyPlaylists; }
    SpotifyPlayback* Playback() { return m_SpotifyPlayback; }
    bool isPlaylistContainerLoaded() const { return m_pcLoaded; }
    bool isLoggedIn(){ return m_loggedIn;}
    // Spotify session callbacks.
    static void SP_CALLCONV loggedIn(sp_session *session, sp_error error);
    static void SP_CALLCONV loggedOut(sp_session *session)
    {
        qDebug() << "Logging out";
        Q_UNUSED(session);
    }
    static void SP_CALLCONV connectionError(sp_session *session, sp_error error)
    {
        Q_UNUSED(session);
        qDebug() << "Connection error: " << sp_error_message(error);

    }
    static void SP_CALLCONV notifyMainThread(sp_session *session)
    {

        Q_UNUSED(session);
        SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
        _session->sendNotifyThreadSignal();

    }
    static void SP_CALLCONV logMessage(sp_session *session, const char *data)
    {
        Q_UNUSED(session);
        qDebug() << "SpotifyLog: " << data;
    }

     void login();
     void logout();
     void testLogin(const QString& username, const QString& pw);
     QString m_username;
     QString m_password;
     QString qid;
     bool m_testLogin, m_loggedInBeforeTest;

signals:
    void notifyMainThreadSignal();
    void notifyLoggedInSignal();
    void notifySyncUpdateSignal( const SpotifyPlaylists::LoadedPlaylist& playlist );
    void testLoginSucceeded( bool, const QString& msg );
public slots:
     void get( const SpotifyPlaylists::LoadedPlaylist& playlist);

private slots:
    void notifyMainThread();

private:

    void clearOldUserdata();
    static SpotifySession* s_instance;
    QThread m_playlistThread;
    SpotifyPlaylists *m_SpotifyPlaylists;
    SpotifyPlayback *m_SpotifyPlayback;
    sp_session_config m_config;
    sp_session *m_session;
    bool m_loggedIn;
    QString m_oldUsername;
    sp_playlistcontainer *m_container;
    bool m_pcLoaded;


};

#endif // SPOTIFYSESSION_H
