/**  This file is part of QT SpotifyWebApi - <hugolm84@gmail.com> ===
 *
 *   Copyright 2011-2012,Hugo Lindström <hugolm84@gmail.com>
 *   Copyright      2012,Leo Franchi    <lfranchi@kde.org>
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
#include <QStringList>

class QTimer;

class SpotifyPlaylists : public QObject
{
    Q_OBJECT
public:
    explicit SpotifyPlaylists( QObject *parent = 0);
    virtual ~SpotifyPlaylists();

    void setPosition( sp_playlist *pl, int oPos, int nPos );
    void setSyncPlaylist( const QString id, bool sync );
    void unsetAllLoaded(){ m_allLoaded = false; m_waitingToLoad.clear(); }

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

    struct AddTracksData{

        LoadedPlaylist pl;
        QVector< sp_track* > finaltracks;
        QStringList origTrackNameList;

        int waitingFor;
        int pos;

    };

    void doSend( const LoadedPlaylist& playlist);

    LoadedPlaylist getPlaylist( const QString id );
    LoadedPlaylist getLoadedPlaylist( sp_playlist *&playlist );
    QList<LoadedPlaylist> getPlaylists() const { return m_playlists; }

    QList<Sync> getSyncPlaylists() const { return m_syncPlaylists; }

    // Send the desired playlist to the client, and turn on syncing
    void sendPlaylist( const QString& playlistId, bool startSyncing );
    void sendPlaylistByRevision( int rev );


    LoadedPlaylist getPlaylistByRevision( int rev );
    void addNewPlaylist( QVariantMap data );

    // Takes a msg from JSON that conforms to the API
    void addTracksToSpotifyPlaylist( QVariantMap data );
    bool removeFromSpotifyPlaylist( QVariantMap data );


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
    //    qDebug() << "Metadata updated for playlist:" << sp_playlist_name( pl ) << sp_playlist_num_tracks(pl);
    }

    static void SP_CALLCONV playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata);
    static void SP_CALLCONV playlistRenamed(sp_playlist *pl, void *userdata)
    {
        Q_UNUSED( pl );
        Q_UNUSED( userdata );
        qDebug() << "Playlist renamned to " << sp_playlist_name( pl );
        SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
        _playlists->playlistNameChange( pl );
    }
    static void SP_CALLCONV tracksMoved(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    static void SP_CALLCONV tracksRemoved(sp_playlist *pl, const int *tracks, int num_tracks, void *userdata);


public slots:

   // void tracksMovedSlot(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    void moveTracks(sp_playlist* pl, QList<int> tracks, int new_position);
    void removeTracksFromSpotify(sp_playlist* pl, QList<int> tracks);
    void loadContainerSlot(sp_playlistcontainer* pc);
    void setPlaylistInProgress( sp_playlist *pl, bool done );
    void addStarredTracksToContainer();
    void addTracksFromSpotify(sp_playlist* pl, QList<sp_track*> tracks, int pos);
    void removePlaylist( sp_playlist *playlist );

    void playlistLoadedSlot(sp_playlist* pl);
signals:

   void send( const SpotifyPlaylists::LoadedPlaylist& );
   void notifyContainerLoadedSignal();
   void notifyStarredTracksLoadedSignal();

   void sendTracksAdded( sp_playlist* pl, const QList< sp_track* >& tracks, const QString& trackPosition );
   void sendTracksRemoved( sp_playlist* pl, const QStringList& trackIds );
   void sendTracksMoved( sp_playlist* pl, const QStringList& trackids, const QString& trackPosition );

private slots:
   void addPlaylist( sp_playlist *);
   void ensurePlaylistsLoadedTimerFired();

private:
   void readSettings();
   void writeSettings();

   void updateRevision( LoadedPlaylist &pl );
   void updateRevision( LoadedPlaylist &pl, int qualifier );
   void playlistNameChange( sp_playlist * pl );
   void checkForPlaylistsLoaded();

   QString trackId( sp_track* track );

   QList<LoadedPlaylist> m_playlists;
   QList<Sync> m_syncPlaylists;
   QSettings m_settings;

   QTimer* m_checkPlaylistsTimer;
   QList< sp_playlist* > m_waitingToLoad;

   bool m_allLoaded;
   bool m_isLoading;
};



Q_DECLARE_METATYPE( sp_playlistcontainer* );
Q_DECLARE_METATYPE( sp_playlist* );
Q_DECLARE_METATYPE( const int* );
Q_DECLARE_METATYPE( QList< sp_track* > );
Q_DECLARE_METATYPE( QList< int > );
#endif // SPOTIFYPLAYLISTS_H
