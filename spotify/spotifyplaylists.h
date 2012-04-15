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
#include <QDateTime>
#include <QTimer>
#include <boost/bind.hpp>
#include "spotifysearch.h"

class QTimer;
class PlaylistClosure;

class SpotifyPlaylists : public QObject
{
    Q_OBJECT
public:
    explicit SpotifyPlaylists( QObject *parent = 0);
    virtual ~SpotifyPlaylists();

    void setPosition( sp_playlist *pl, int oPos, int nPos );
    void setSyncPlaylist( const QString id, bool sync );
    // This will unload all playlists, usefull when userswitch
    void unsetAllLoaded(){ m_allLoaded = false; m_waitingToLoad.clear(); clear(); }

    struct RevisionChanges{
        // Md5 hash of pl_name and timestamp
        QString revId;
        QList<QString> revTrackIDs;
        QList<QString> revRemovedTrackIDs;
    };

    struct LoadedPlaylist{
      bool starContainer_;
      bool isSubscribed;
      bool isCollaborative;
      bool sync_;
      bool isLoaded;
      // Revision timestamp
      int newTimestamp;
      int oldTimestamp;

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

        QString plid;
        sp_playlist* playlist;
        QVector< sp_track* > finaltracks;
        QVector< sp_search* > searchOrder;

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
    LoadedPlaylist getPlaylistByRevision( QString rev );

    // Takes a msg from JSON that conforms to the API
    void addTracksToSpotifyPlaylist( const QVariantMap& data );
    bool removeFromSpotifyPlaylist( const QVariantMap& data );
    void renamePlaylist( const QVariantMap& data );
    void addNewPlaylist( const QVariantMap& data );
    sp_error moveTracksInSpotifyPlaylist( const QString& playlistId, const QVariantList& tracks, const QString& newStartPositionId );


    void addSubscribedPlaylist( const QString &uri );
    void removeSubscribedPlaylist(const QString &uri );
    void setCollaborative(const QString &playlistUri, bool collab );

    // Mixed
    sp_playlist *getPlaylistFromUri( const QString &uri );

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
    static void SP_CALLCONV playlistMetadataUpdated(sp_playlist *pl, void *userdata);

    static void SP_CALLCONV playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata);
    static void SP_CALLCONV playlistRenamed(sp_playlist *pl, void *userdata);
    static void SP_CALLCONV tracksMoved(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    static void SP_CALLCONV tracksRemoved(sp_playlist *pl, const int *tracks, int num_tracks, void *userdata);

    void waitForLoad( sp_playlist *playlist );

    /**
     * If you need to re-call some function when a certain track in a playlist has become loaded, pass it to the PlaylistClosure and add it to the list.
     * Each closure will get tested (condition() in the closure, see header) for each playlist that has state changes.
     */
    void addStateChangedCallback( PlaylistClosure* closure );

    void clear();
public slots:

   // void tracksMovedSlot(sp_playlist *pl, const int *tracks, int num_tracks, int new_position, void *userdata);
    void moveTracks(sp_playlist* pl, QList<int> tracks, int new_position);
    void removeTracksFromSpotify(sp_playlist* pl, QList<int> tracks);
    void loadContainerSlot(sp_playlistcontainer* pc);
    void setPlaylistInProgress( sp_playlist *pl, bool done );
    void addStarredTracksToContainer();
    void addTracksFromSpotify(sp_playlist* pl, QList<sp_track*> tracks, int pos);
    void removePlaylistNotification( sp_playlist *playlist );
    void playlistLoadedSlot(sp_playlist* pl);
    void addPlaylist( sp_playlist *, bool forceSync = false, bool isSubscribed = false );
    void doRemovePlaylist( sp_playlist* playlist );

    // slot that calls our SpotifySearch::addSearchedTrack callback
    void addSearchedTrack( sp_search*, void * );
signals:
    void sendLoadedPlaylist( const SpotifyPlaylists::LoadedPlaylist& );
    void notifyContainerLoadedSignal();
    void notifyStarredTracksLoadedSignal();
    void notifyNameChange( const SpotifyPlaylists::LoadedPlaylist &playlist );
    void sendTracksAdded( sp_playlist* pl, const QList< sp_track* >& tracks, const QString& trackPosition );
    void sendTracksRemoved( sp_playlist* pl, const QStringList& trackIds );
    void sendTracksMoved( sp_playlist* pl, const QStringList& trackids, const QString& trackPosition );

private slots:

    void ensurePlaylistsLoadedTimerFired();
    void checkWaitingForLoads();

    void doAddNewPlaylist( sp_playlist* pl, const QVariantList& tracks, bool sync, const QString& qid );
    void doAddTracksToSpotifyPlaylist( const QVariantList& tracks, sp_playlist* playlist, const QString& playlistId, const int startPosition );

private:
    void readSettings();
    void writeSettings();

    void updateRevision( LoadedPlaylist &pl );
    void updateRevision( LoadedPlaylist &pl, int qualifier, QStringList removedTracks = QStringList() );
    void playlistNameChange( sp_playlist * pl );
    void checkForPlaylistsLoaded();
    void checkForPlaylistCallbacks( sp_playlist *pl, void *userdata );

    int findTrackPosition( const QList< sp_track* > tracks, const QString& trackId );

    QString trackId( sp_track* track );

    QList<LoadedPlaylist> m_playlists;
    QList<Sync> m_syncPlaylists;
    QSettings m_settings;

    QTimer* m_checkPlaylistsTimer;
    QTimer* m_periodicTimer;
    QList< sp_playlist* > m_waitingToLoad;
    QList< PlaylistClosure* > m_stateChangedCallbacks;

    QSet<QString> m_playlistNameCreationToIgnore;

    bool m_allLoaded;
    bool m_isLoading;
};


// Use this with boost::bind and bind the first arg
bool checkTracksAreLoaded(QList<sp_track*> waitingForLoaded);

Q_DECLARE_METATYPE( sp_playlistcontainer* );
Q_DECLARE_METATYPE( sp_playlist* );
Q_DECLARE_METATYPE( const int* );
Q_DECLARE_METATYPE( QList< sp_track* > );
Q_DECLARE_METATYPE( QList< int > );

#endif // SPOTIFYPLAYLISTS_H
