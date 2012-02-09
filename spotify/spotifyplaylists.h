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

#ifndef SPOTIFYPLAYLISTS_H
#define SPOTIFYPLAYLISTS_H
#include <libspotify/api.h>
#include <QList>
#include <QString>
#include <QDebug>
#include <QSettings>
#include <QObject>

class SpotifyPlaylists : public QObject
{
    Q_OBJECT
public:
    explicit SpotifyPlaylists( QObject *parent = 0);
    virtual ~SpotifyPlaylists();
    void addPlaylist( sp_playlist *);
    void removePlaylist( sp_playlist *playlist );
    void setPlaylistInProgress( sp_playlist *pl, bool done );
    void setPosition( sp_playlist *pl, int oPos, int nPos );
    void setSyncPlaylist( const QString id );
    //void sendSyncSignal();

    void doSend()
      {
        qDebug() << "Sending 7";
        emit( send( 7 ) );
      }

    struct LoadedPlaylist{
      bool starContainer_;
      bool sync_;
      bool isLoaded;
      QString id_;
      sp_playlist* playlist_;
      QList<sp_track*> tracks_;

    };
    struct Sync {
         QString id_;
         bool sync_;
     };

    LoadedPlaylist getPlaylist( const QString id );
    QList<LoadedPlaylist> getPlaylists() const { return m_playlists; }
    QList<LoadedPlaylist> m_playlists;
    QList<Sync> getSyncPlaylists() const { return m_syncPlaylists; }


    // Spotify playlist container callbacks.
    static void SP_CALLCONV playlistAddedCallback( sp_playlistcontainer* pc, sp_playlist* playlist,  int position, void* userdata );
    static void SP_CALLCONV playlistRemovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, void* userdata );
    static void SP_CALLCONV playlistMovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, int new_position, void* userdata );
    static void SP_CALLCONV playlistContainerLoadedCallback( sp_playlistcontainer* pc, void* userdata);

    // initially load playlist
    static void SP_CALLCONV syncStateChanged(sp_playlist* pl, void* userdata);

    // Spotify playlist callbacks - when loading a playlist
    static void SP_CALLCONV stateChanged(sp_playlist* pl, void* userdata);
    static void SP_CALLCONV tracksAdded(sp_playlist *pl, sp_track * const *tracks, int num_tracks, int position, void *userdata);
    static void SP_CALLCONV playlistMetadataUpdated(sp_playlist *pl, void *userdata)
    {
        qDebug() << "Metadata updated";
        SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
        _playlists->addPlaylist( pl );
    }

    static void SP_CALLCONV playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata)
    {
        qDebug() << "Update in progress";
        SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
        _playlists->setPlaylistInProgress( pl, done );
    }
    static void SP_CALLCONV playlistRenamed(sp_playlist *pl, void *userdata)
    {
        Q_UNUSED( pl );
        Q_UNUSED( userdata );
        qDebug() << "Playlist renamned";
    }
    static void SP_CALLCONV tracksMoved(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata)
    {

        Q_UNUSED( tracks );
        Q_UNUSED( num_tracks );
        Q_UNUSED( new_position );
        qDebug() << "Tracks moved";
        SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
        _playlists->addPlaylist( pl );
    }
    static void SP_CALLCONV tracksRemoved(sp_playlist *pl, const int *tracks, int num_tracks, void *userdata)
    {
        Q_UNUSED( tracks );
        Q_UNUSED( num_tracks );
        qDebug() << "Tracks removed";
        SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
        _playlists->addPlaylist( pl );
    }


signals:
   void send( int );

private:

    QList<Sync> m_syncPlaylists;

};




#endif // SPOTIFYPLAYLISTS_H
