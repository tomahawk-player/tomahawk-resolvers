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
    //void addPlaylist( sp_playlist *);
    void addTracks(sp_playlist* pl, sp_track * const *tracks, int num_tracks, int pos);
    //void removeTracks(sp_playlist* pl, int *tracks, int num_tracks);
    void removePlaylist( sp_playlist *playlist );
    //void moveTracks(sp_playlist* pl, const int *tracks, int num_tracks, int new_position);
    //void setPlaylistInProgress( sp_playlist *pl, bool done );
    void setPosition( sp_playlist *pl, int oPos, int nPos );
    void setSyncPlaylist( const QString id );

    struct RevisionChanges{

        int revId;
        QList<sp_track*> changedTracks;

    };

    struct LoadedPlaylist{
      bool starContainer_;
      bool sync_;
      bool isLoaded;
      /**
        Revision
        @todo: hash string
        **/
      int newRev;
      int oldRev;
      int sentRev;

      QString name_;
      QString id_;
      sp_playlist* playlist_;
      QList<sp_track*> tracks_;
      QList<RevisionChanges> revisions;

    };
    struct Sync {
         QString id_;
         bool sync_;
     };


    void doSend( LoadedPlaylist playlist)
    {
        qDebug() << "Sending " << sp_playlist_name( playlist.playlist_ );
        emit( send( playlist ) );
    }

    LoadedPlaylist getPlaylist( const QString id );
    LoadedPlaylist getLoadedPlaylist( sp_playlist *&playlist );
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

    static void SP_CALLCONV playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata);
    static void SP_CALLCONV playlistRenamed(sp_playlist *pl, void *userdata)
    {
        Q_UNUSED( pl );
        Q_UNUSED( userdata );
        qDebug() << "Playlist renamned";
    }
    static void SP_CALLCONV tracksMoved(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    static void SP_CALLCONV tracksRemoved(sp_playlist *pl, const int *tracks, int num_tracks, void *userdata);
    void sendPlaylistByRevision( int rev );
    LoadedPlaylist getPlaylistByRevision( int rev );
    void addNewPlaylist( QVariantMap data );
    void removeFromSpotifyPlaylist( QVariantMap data );
public slots:
   // void tracksMovedSlot(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    void moveTracks(sp_playlist* pl, int *tracks, int num_tracks, int new_position);
    void removeTracks(sp_playlist* pl, int *tracks, int num_tracks);
    void loadContainerSlot(sp_playlistcontainer* pc);
    void addPlaylist( sp_playlist *);
    void setPlaylistInProgress( sp_playlist *pl, bool done );
    void addStarredTracksToContainer();
    void allPlaylistsLoaded();
signals:
   void send( SpotifyPlaylists::LoadedPlaylist );
   void sendPl( SpotifyPlaylists::LoadedPlaylist );
   void notifyContainerLoadedSignal();
   void notifyStarredTracksLoadedSignal();
private:
   void readSettings();
   void updateRevision( LoadedPlaylist *pl );
   void updateRevision( LoadedPlaylist *pl, int qualifier );
   QList<Sync> m_syncPlaylists;
   QSettings m_settings;
   int m_currentPlaylistCount;


};



Q_DECLARE_METATYPE( sp_playlistcontainer* );
Q_DECLARE_METATYPE( sp_playlist* );
Q_DECLARE_METATYPE( const int* );
#endif // SPOTIFYPLAYLISTS_H
