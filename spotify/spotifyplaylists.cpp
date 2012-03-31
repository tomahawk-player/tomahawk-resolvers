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

#include "spotifyplaylists.h"

#include "spotifysearch.h"
#include "callbacks.h"
#include "spotifyresolver.h"

#include <QObject>
#include <QThread>
#include <QDateTime>
#include <QTimer>

void printPlaylistTracks( const QList<sp_track* > tracks )
{
    for ( int i = 0; i < tracks.size(); i++ )
    {
        char id[256];
        sp_link* l = sp_link_create_from_track( tracks[i], 0 );
        if ( l )
            sp_link_as_string( l, id, sizeof( id ) );
        qDebug() << i << ":" << id << sp_track_name( tracks[i] ) << sp_artist_name( sp_track_artist( tracks[i], 0 ) ) << sp_album_name( sp_track_album( tracks[i] ) );
    }

}

SpotifyPlaylists::SpotifyPlaylists( QObject *parent )
   : QObject( parent )
   , m_checkPlaylistsTimer( new QTimer( this ) )
   , m_allLoaded( false )
   , m_isLoading( false )
{
    /**
      Metatypes for invokeMethod
      **/
    qRegisterMetaType< sp_playlist* >("sp_playlist*");
    qRegisterMetaType< int* >("int*");
    qRegisterMetaType< QVariantMap >("QVariantMap");
    qRegisterMetaType< sp_playlistcontainer* >("sp_playlist_continer*");
    qRegisterMetaType< SpotifyPlaylists::LoadedPlaylist >("SpotifyPlaylists::LoadedPlaylist");
    qRegisterMetaType< QList<sp_track* > >("QList<sp_track*>");
    qRegisterMetaType< QList<int> >("QList<int>");

    m_checkPlaylistsTimer->setInterval( 2000 );
    m_checkPlaylistsTimer->setSingleShot( true );
    connect( m_checkPlaylistsTimer, SIGNAL( timeout() ), this, SLOT( ensurePlaylistsLoadedTimerFired() ) );

    readSettings();
}



/**
    Read the QSettings to set the sync states from previous settings
**/

void
SpotifyPlaylists::readSettings()
{

    int size = m_settings.beginReadArray( "syncPlaylists" );

    for ( int i = 0; i < size; ++i )
    {
         m_settings.setArrayIndex( i );
         Sync sync;
         sync.id_ = m_settings.value( "id" ).toString();
         qDebug() << sync.id_;
         sync.sync_ = m_settings.value( "sync" ).toBool();
         m_syncPlaylists.append( sync );
    }

    m_settings.endArray();
}


void
SpotifyPlaylists::writeSettings()
{
    // Rewrite settings
    m_settings.remove( "syncPlaylists" );
    m_settings.beginWriteArray("syncPlaylists");
    for ( int i = 0; i < m_syncPlaylists.size(); ++i )
    {
        m_settings.setArrayIndex( i );
        m_settings.setValue( "id" , m_syncPlaylists.at( i ).id_ );
        m_settings.setValue( "sync" , m_syncPlaylists.at( i ).sync_ );
    }
    m_settings.endArray();
}


/**
  Destructor
    This destructor is important.
    It removes callbacks and frees playlists and its tracks
**/

SpotifyPlaylists::~SpotifyPlaylists()
{

    writeSettings();
    qDebug() << "Destroying playlists";
    for ( int i = 0; i < m_playlists.size(); i++ )
    {
        Sync s;
        s.id_ = m_playlists[ i ].id_;
        const bool sync = m_syncPlaylists.contains( s );

        if ( sync )
            sp_playlist_remove_callbacks( m_playlists[ i ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
        else
            sp_playlist_remove_callbacks( m_playlists[ i ].playlist_, &SpotifyCallbacks::playlistCallbacks, this);

        sp_playlist_release( m_playlists[ i ].playlist_ );
    }
 /*   for ( int i = 0 ; i < sp_playlistcontainer_num_playlists( SpotifySession::getInstance()->PlaylistContainer() ) ; ++i )
    {
        sp_playlist* playlist = sp_playlistcontainer_playlist( SpotifySession::getInstance()->PlaylistContainer(), i );
 //       qDebug() << "Remvoing callbacks on " << sp_playlist_name( playlist );
        sp_playlist_remove_callbacks( playlist, &SpotifyCallbacks::playlistCallbacks, SpotifySession::getInstance()->Playlists() );
        if( i < m_playlists.size() )
        {
            sp_playlist_release( m_playlists[i].playlist_ );
            foreach( sp_track *track, m_playlists[i].tracks_ )
            {
    //            qDebug() << "Releasing track" << sp_track_name( track );
                sp_track_release( track );
            }
        }

    }
*/
}

/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
    Will keep trying to add a playlist if its not in the list
**/
void
SpotifyPlaylists::stateChanged( sp_playlist* pl, void* userdata )
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    //qDebug() << Q_FUNC_INFO << "PLAYLIST_STATE_CHANGED for *non* synced playlist" << sp_playlist_name(pl) << "is loaded" << sp_playlist_is_loaded(pl) << sp_playlist_num_tracks(pl) << "tracks";
    // If the playlist isn't loaded yet we have to wait

    if ( !sp_playlist_is_loaded( pl ) )
    {
//       qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }
    else
    {
        // if it was just loaded and we don't have it yet, add it
        LoadedPlaylist playlist;
        playlist.playlist_ = pl;
        const int index = _playlists->m_playlists.indexOf( playlist );
        if ( index == -1 )
        {
            qDebug() << Q_FUNC_INFO << "Invoking addPlaylist from stateChanged callback as playlist is not in our list!";
            QMetaObject::invokeMethod( _playlists, "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl) );
        }
    }
}


/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
    @note: Will send the playlist when loaded, at startup
**/

void
SpotifyPlaylists::syncStateChanged( sp_playlist* pl, void* userdata )
{
    qDebug() << "Playlist state changed for synced playlist:" << pl << sp_playlist_name(pl) << "is loaded?" << sp_playlist_is_loaded(pl);
    if ( !sp_playlist_is_loaded( pl ) )
    {
//       qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }

    // Send playlist with syncflags when loaded
    // @note: disabled atm

//    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
//    _playlists->doSend( _playlists->getLoadedPlaylist( pl ) ); //_playlists->doSend();
}

/**
 getLoadedPLaylist( sp_playlist )
   Gets a specific playlist from the list with id (uri)
**/

SpotifyPlaylists::LoadedPlaylist
SpotifyPlaylists::getLoadedPlaylist( sp_playlist *&playlist )
{
    LoadedPlaylist pl;
    pl.playlist_ = playlist;
    int index = m_playlists.indexOf( pl );
    if( index != -1)
        return m_playlists.at( index );
    return pl;
}


void SpotifyPlaylists::doSend( const SpotifyPlaylists::LoadedPlaylist& playlist )
{
    qDebug() << "Sending " << sp_playlist_name( playlist.playlist_ ) << "playlist to client with:" << sp_playlist_num_tracks( playlist.playlist_ );
    emit( send( playlist ) );
}


/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/

void
SpotifyPlaylists::playlistContainerLoadedCallback( sp_playlistcontainer* pc, void* userdata)
{

    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );

    QMetaObject::invokeMethod( _session->Playlists(), "loadContainerSlot", Qt::QueuedConnection, Q_ARG(sp_playlistcontainer*, pc) );

}

void
SpotifyPlaylists::loadContainerSlot(sp_playlistcontainer *pc){

    qDebug() << Q_FUNC_INFO;
    if( !m_allLoaded && !m_isLoading )
    {
        qDebug() << "Loading starred tracks playlist";
        addStarredTracksToContainer();

        qDebug() << "Container load from thread id" << thread()->currentThreadId();
        int numPls = sp_playlistcontainer_num_playlists( pc );

        if(numPls == -1)
        {
            qDebug() << "Container is empty!";
            return;
        }

        qDebug() << "Trying to load " << numPls << "playlists from this container!";

        m_isLoading = true;
        m_waitingToLoad.clear();

        for ( int i = 0 ; i < numPls; ++i )
        {

            sp_playlist_type type = sp_playlistcontainer_playlist_type(pc, i);
            /**
              There are 4 types of playlist
                Placeholder ( Can be anything, artist, track, playlist whatever (resides in inbox)
                Folder Start
                Folder End
                Playlist
              Folder is just a name for a parent
              Placeholder we dont care about atm
              Playlist is what we want. Thus, sp_playlistcontainer_num_playlist is not
              really a great nominee for playlistcount.
              **/
            if( type == SP_PLAYLIST_TYPE_PLAYLIST )
            {
                sp_playlist* pl = sp_playlistcontainer_playlist( pc, i );
                //sp_playlist_add_callbacks( pl, &SpotifyCallbacks::playlistCallbacks, SpotifySession::getInstance()->Playlists() );

                qDebug() << "Adding playlist:" << pl << sp_playlist_is_loaded( pl ) << sp_playlist_name( pl ) << sp_playlist_num_tracks( pl );
                if ( sp_playlist_is_loaded( pl ) )
                    addPlaylist( pl );
                else
                    m_waitingToLoad << pl;
            }
        }

        checkForPlaylistsLoaded();
        // Add starredTracks, should be an option

        SpotifySession::getInstance()->setPlaylistContainer( pc );

    }else
    {
        qWarning() << "loadContainerSlot called twice! SOMETHING IS WRONG!!";
    }

    m_checkPlaylistsTimer->start();
}

void
SpotifyPlaylists::addStarredTracksToContainer()
{
    /**
      This creates the starred tracks playlist, and will automatically add it to the synclist
    **/
    sp_playlist* starredTracks = sp_session_starred_create( SpotifySession::getInstance()->Session() );
    sp_playlist_add_callbacks( starredTracks, &SpotifyCallbacks::syncPlaylistCallbacks, this );

    QString name = sp_user_canonical_name( sp_session_user( SpotifySession::getInstance()->Session() ) );

    // The starredTracks container is not a playlist, but it has a special uri
    QString starredId = "spotify:user:" + name + ":playlist:0000000000000000000000";

    qDebug() << "Created starred playlist:" << starredTracks << sp_playlist_name( starredTracks );
    addPlaylist(starredTracks);

    // Set it to syncSettings
    setSyncPlaylist( starredId, true );

    emit notifyStarredTracksLoadedSignal();


}

/**
  Callback
    PlaylistAdded
    Called from libspotify when a new playlist is added
**/

void
SpotifyPlaylists::playlistAddedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, void* userdata )
{
    // If the playlist isn't loaded yet we have to wait
    if ( !sp_playlist_is_loaded( playlist ) )
    {
      qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }

   qDebug() << Q_FUNC_INFO << "IN PLAYLISTADDED CALLBACK for this playlist:" << sp_playlist_name( playlist );
   SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );

   QMetaObject::invokeMethod( _session->Playlists(), "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist) );

}
/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/

void
SpotifyPlaylists::playlistMovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, int new_position, void* userdata ) {

    qDebug() << "Playlist Moved";
    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );

    QMetaObject::invokeMethod( _session->Playlists(), "setPosition", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(int, position), Q_ARG(int, new_position) );
}
/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/

void
SpotifyPlaylists::playlistRemovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, void* userdata ) {

    Q_UNUSED( position );

    qDebug() << "Playlist removed";

    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );
    QMetaObject::invokeMethod( _session->Playlists(), "removePlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist) );

    _session->setPlaylistContainer( pc );
}

/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/

void
SpotifyPlaylists::tracksAdded(sp_playlist *pl, sp_track * const *tracks, int num_tracks, int position, void *userdata)
{
    qDebug() << "Tracks Added";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    // We want to make sure it lives on to the queued slot
    QList<sp_track*> trackList;
    for( int i = 0; i < num_tracks; i++ )
    {
        sp_track* track = tracks[i];
        sp_track_add_ref( track );
        trackList << track;
    }

    QMetaObject::invokeMethod( _playlists, "addTracksFromSpotify", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(QList<sp_track*>, trackList), Q_ARG(int, position) );
}



/**
   addTracks(sp_playlist*, sp_tracks * const *tracks, int num_tracks)
   This is called from callback to add tracks to this playlist container
**/
void
SpotifyPlaylists::addTracksFromSpotify(sp_playlist* pl, QList<sp_track*> tracks, int pos)
{
    qDebug() << "Adding tracks to" << sp_playlist_name(pl) << "from spotify notification";

    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = m_playlists.indexOf( playlist );

    if( index == -1 ) {
        qWarning() << "Got added tracks for a playlist we don't know about? WTF!" << sp_playlist_name( pl );

        return;
    }

    int startPos = pos == 0 ? 0 : pos - 1;

    // find the spotify track of the song before the newly inserted one
    char trackStr[256];
    sp_link* link = sp_link_create_from_track( sp_playlist_track( pl, startPos ), 0 );
    sp_link_as_string( link, trackStr, sizeof( trackStr ) );
    const QString trackPosition = QString::fromUtf8( trackStr );
    sp_link_release( link );

    int runningPos = pos; // We start one before, since spotify reports the end index, not index of item to insert after
    foreach( sp_track* track, tracks )
    {
        qDebug() << "Pos" << runningPos;
        qDebug() << "Adding track " << sp_track_name( track );
        sp_track_add_ref( track );
        m_playlists[index].tracks_.insert(runningPos, track );
        runningPos++;

        // This undoes the sp_track_add_ref in the addTracks callback
        sp_track_release( track );
        qDebug() << "Sanity check:" << sp_track_is_loaded( track );
    }

    runningPos++; // We found the track to insert after, so increase for new index
    //qDebug() << "Playlist changed, updateing revision";
    updateRevision( m_playlists[index] );

    if ( sApp->ignoreNextUpdate() )
    {
        qDebug() << "Ignoring spotify track added notification since it came from our own track insertion!";
        sApp->setIgnoreNextUpdate( false );
        return;
    }


    emit sendTracksAdded(pl, tracks, trackPosition);
}


/**
  getPlaylistByRevision
  Get the playlist by last known revision,
  return empty LoadedPlaylist if non found.
**/
SpotifyPlaylists::LoadedPlaylist
SpotifyPlaylists::getPlaylistByRevision( int revision )
{
    RevisionChanges rev;
    rev.revId = revision;

    LoadedPlaylist playlist;
    foreach( LoadedPlaylist pl, m_playlists)
    {
        if( pl.revisions.contains( rev ) )
            return pl;
    }
    return playlist;

}


/**
 * Sends the latest version of a playlist, and starts syncing if necessary
 */
void
SpotifyPlaylists::sendPlaylist( const QString& playlistId, bool startSyncing )
{
    LoadedPlaylist pl;
    pl.id_ = playlistId;
    if ( !m_playlists.contains( pl ) )
    {
        qWarning() << "Asked to fetch and sync a playlist that we dont' know about!!" << playlistId;
        return;
    }

    pl = m_playlists.at( m_playlists.indexOf( pl ) );

    if ( !pl.isLoaded )
    {
        qWarning() << "SpotiyPlaylists asked to send playlist that is not loaded yet!" << playlistId << startSyncing;
        return;
    }

    // NOTE HACK since m_playlists stores by value, setSyncPlaylist modifies m_playlists, but that
    // won't change our local copy pl.
    if ( !pl.sync_ && startSyncing )
        setSyncPlaylist( playlistId, true );

    doSend( m_playlists.at( m_playlists.indexOf( pl ) ) );
}


/**
  sendPlaylistByRevision
  Will send a playlist that contains revision
  **/
void
SpotifyPlaylists::sendPlaylistByRevision( int revision )
{
    RevisionChanges rev;
    rev.revId = revision;

    foreach( LoadedPlaylist pl, m_playlists)
    {
        if( pl.revisions.contains( rev ) ){
            qDebug() << "Sending revision";
            doSend( pl );
            break;
        }
    }


}
/**
  removeTracks(sp_playlist*, const int*tracks, int num_tracks)
  This is called from callback, removes tracks from this playlist when
  changed in Spotify
**/
void
SpotifyPlaylists::removeTracksFromSpotify(sp_playlist* pl, QList<int> tracks)
{
    qDebug() << "Removing tracks in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );

    if( index == -1 ) {
        qWarning() << "Got added tracks for a playlist we don't know about? WTF!" << sp_playlist_name( pl );

        return;
    }

    QStringList trackIds;
    QList< sp_track* > toRemove;
    foreach( int pos, tracks )
    {
        int realIdx = pos;
        if ( pos == m_playlists[index].tracks_.size() )
            realIdx--;

        if ( realIdx < 0 || realIdx >= m_playlists[index].tracks_.size() )
        {
            qWarning() << "Tried to remove tracks at index:" << realIdx << "(originally" << pos << ") from tracks list that is out of bounds!! We have size:" << m_playlists[index].tracks_.size();
            continue;
        }

        qDebug() << "Removing track at" << realIdx;
        sp_track* track = m_playlists[index].tracks_.at( realIdx );
        trackIds << trackId( track );
        toRemove << track;
    }

    foreach ( sp_track* remove, toRemove )
    {
        const int got = m_playlists[ index ].tracks_.removeAll( remove );

        qDebug() << "removing:" << sp_track_name(remove) << sp_artist_name(sp_track_artist(remove, 0)) << "and actually removed:" << got;
        sp_track_release( remove );
    }

    // We need to update the revision with current timestamp
    int timestamp =  QDateTime::currentMSecsSinceEpoch() / 1000;
//         qDebug() << "Updateing revision with removetrack timestamp " << timestamp;
    updateRevision( m_playlists[index], timestamp );

    if ( sApp->ignoreNextUpdate() )
    {
        qDebug() << "Ignoring spotify track removed notification since it came from our own track removal!";
        sApp->setIgnoreNextUpdate( false );
        return;
    }
    emit sendTracksRemoved(pl, trackIds);
}

/**
    moveTracks(sp_playlist* pl, const int *tracks, int num_tracks, int new_position)
    called from callback
**/

void
SpotifyPlaylists::moveTracks(sp_playlist* pl, QList<int> tracks, int new_position)
{

    qDebug() << "Moving tracks in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );
    if( index == -1 ) {
        qWarning() << "Got added tracks for a playlist we don't know about? WTF!" << sp_playlist_name( pl );

        return;
    }

    sp_track* beforeinsert = m_playlists[index].tracks_.at( new_position - 1 );

    // find the spotify track of the song before the newly inserted one
    const QString trackPosition = trackId( beforeinsert );

    QList<sp_track*> toInsert;
    QStringList moveIds;
    foreach( int fromPos, tracks )
    {
        toInsert << m_playlists[index].tracks_[fromPos];
        moveIds << trackId( m_playlists[index].tracks_[fromPos] );
    }
    foreach( sp_track* removing, toInsert )
        m_playlists[index].tracks_.removeAll( removing );


    const int insertingPos = m_playlists[index].tracks_.indexOf( beforeinsert );
    for( int i = toInsert.size() - 1; i >= 0; i-- )
    {
//         qDebug() << "Moving track at pos " << fromPos << " to pos" << new_position;
        m_playlists[index].tracks_.insert(insertingPos, toInsert[i]);
    }

    qDebug() << "Tracks moved";
    // We need to update the revision with current timestamp
    int timestamp =  QDateTime::currentMSecsSinceEpoch() / 1000;
    qDebug() << "Updateing revision with move track timestamp " << timestamp;

    updateRevision( m_playlists[index], timestamp );

    emit sendTracksMoved(pl, moveIds, trackPosition);
}

QString
SpotifyPlaylists::trackId( sp_track* track )
{
    QString trackIdStr;

    char trackId[256];
    sp_link* link = sp_link_create_from_track( track, 0 );
    sp_link_as_string( link, trackId, sizeof( trackId ) );
    trackIdStr = QString::fromUtf8( trackId );
    sp_link_release( link );

    return trackIdStr;
}




/**
 getPLaylist( const QString )
 Gets a specific playlist from the list with id (uri)

**/
SpotifyPlaylists::LoadedPlaylist
SpotifyPlaylists::getPlaylist( const QString id )
{
    LoadedPlaylist pl;
    pl.id_ = id;
    int index = m_playlists.indexOf( pl );
    if( index != -1)
        return m_playlists.at( index );
    return pl;
}

/**
 * setSyncPlaylist( const QString )
 *   sets syncflags on a playlist
 *   Saves state to QSettings
 **/
void
SpotifyPlaylists::setSyncPlaylist( const QString id, bool sync )
{
    LoadedPlaylist pl;
    pl.id_ = id;
    qDebug() << "Setting sync for " << id << "to:" << sync;
    int index = m_playlists.indexOf( pl );
    if( index != -1 )
    {
        // Set QSettings to be able to remember state on startup
        Sync syncThis;
        syncThis.id_ = id;
        syncThis.sync_ = sync;
        int syncIndex = m_syncPlaylists.indexOf( syncThis );

        // The playlist isnt in syncmode yet, set it
        if( sync )
        {
            // We might be setting an (already synced previously) playlist to sync
            // during the initial load. in that case loadSettinsg() loaded it in m_syncPlaylists
            // but we just now loaded the real playlist from spotify, so sync it up
            if ( !m_syncPlaylists.contains( syncThis ) )
                m_syncPlaylists.append( syncThis );

            m_playlists[ index ].sync_ = true;
            sp_playlist_remove_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::playlistCallbacks, this);
            qDebug() << "ADDING SYNC CALLBACKS FOR PLAYLIST:" << sp_playlist_name( m_playlists[ index ].playlist_ );

            sp_playlist_add_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
        }
        // The playlist is in syncmode, but user wants to remove it
        else if( syncIndex != -1 && !sync )
        {
            m_syncPlaylists.removeAt( syncIndex );
            m_playlists[ index ].sync_ = false;
            sp_playlist_remove_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
            sp_playlist_add_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::playlistCallbacks, this);
        }

        writeSettings();
    }
    else
    {
        qWarning() << "Tried to set sync to " << sync << "for a playlist that doesn't exist!";
    }
}



/**
  tracksRemoved
  Callback from spotify
  **/
void SpotifyPlaylists::tracksRemoved(sp_playlist *playlist, const int *tracks, int num_tracks, void *userdata)
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    QList<int> removedTrackIndices;
    for (int i = 0; i < num_tracks; i++)
        removedTrackIndices << tracks[i];

    qDebug() << "Tracks removed callback for playlist:" << sp_playlist_name( playlist ) << "and indices removed:" << removedTrackIndices << ", now calling member func";
    QMetaObject::invokeMethod( _playlists, "removeTracksFromSpotify", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(QList<int>, removedTrackIndices));
}

/**
  tracksMoved
  **/
void
SpotifyPlaylists::tracksMoved(sp_playlist *playlist, const int *tracks, int num_tracks, int new_position, void *userdata)
{

    qDebug() << "Tracks moved";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    QList<int> movedTrackIndices;
    for (int i = 0; i < num_tracks; i++)
        movedTrackIndices << tracks[i];

    QMetaObject::invokeMethod( _playlists, "moveTracks", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(QList<int>, movedTrackIndices), Q_ARG(int, new_position) );

}


/**

 setPosition( sp_playlist *, int, int )
   Updates the position of the playlist, if moved
**/
void SpotifyPlaylists::setPosition( sp_playlist *playlist, int oPos, int nPost )
{
    LoadedPlaylist pl;
    pl.playlist_ = playlist;

    int index = m_playlists.indexOf( pl );

    if( index != -1)
        if( m_playlists.count() > nPost )
            m_playlists.move( oPos, nPost ); //( index );

}

/**
 setPosition( sp_playlist *, int, int )
   Updates the position of the playlist, if moved
**/
void
SpotifyPlaylists::removePlaylist( sp_playlist *playlist )
{
    LoadedPlaylist pl;
    pl.playlist_ = playlist;

    int index = m_playlists.indexOf( pl );

    if( index != -1)
        m_playlists.removeAt( index );

}

/**
 setPlaylistInProgress( sp_playlist *, bool)
   This function is called from callback
   Sets a bool on the playlist if its loading or not
**/
void
SpotifyPlaylists::setPlaylistInProgress( sp_playlist *pl, bool done )
{
//    qDebug()<< Q_FUNC_INFO << "got PLAYLIST_IN_PROGRESS with playlist and done?: " << sp_playlist_name(pl) << done << "playlist is loaded?" << sp_playlist_is_loaded(pl);
//     qDebug() << "In Progress in thread id" << thread()->currentThreadId();
//     LoadedPlaylist playlist;
//     playlist.playlist_ = pl;
//
//     const int index = m_playlists.indexOf( playlist );
//
//     if( index != -1 ){
//         qDebug() << "Playlist progress is" << (done ? "done" : "still loading..." ) << index << "(" << sp_playlist_name(pl) << ")";
//         m_playlists[ index ].isLoaded = done;
//         if( done && m_playlists[index].sync_)
//         {
//             // Sometimes, the api will send the playlist twice, dont do this
//             // if its allready been sent.
//
//             if( m_playlists[ index ].sentRev != m_playlists[ index ].newRev ){
//                 m_playlists[ index ].sentRev = m_playlists[ index ].newRev;
// //                foreach( RevisionChanges changes, m_playlists[index].revisions)
// //                    qDebug() << "Revision id " << changes.revId;
//                 doSend( m_playlists[ index ] );
//             }
//         }
//     }


}

/**
  playlistUpdateInProgress
  Callback, fired whenever a change is processed
  **/
void
SpotifyPlaylists::playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata)
{
//     qDebug() << "Update in progress";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
//     qDebug() << "Invoking setPlaylistInProgress from thread id" << _playlists->thread()->currentThreadId();
    QMetaObject::invokeMethod( _playlists, "setPlaylistInProgress", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(bool, done) );

}

/**
  Create a playlist with, or without data
  which appends to spotify container

    QVariantMap data;
    data[ "playlistname" ] = "ewplaylist";
    data[ "trackcount" ] = 1;
    QVariantList trackList;
    QVariantMap track;
    track[ "artist" ] = "Madonna";
    track[ "track" ] = "Like a virgin";
    trackList << track;
    data[ "tracklist" ] = trackList;

    addNewPlaylist( data );
  **/
void
SpotifyPlaylists::addNewPlaylist( QVariantMap data ){

    qDebug() << "Creating playlist with name " << data.value( "playlistname");
    QString artist, title, album, playlistname;

    playlistname = data.value( "playlistname").toString();
    sp_playlist *playlist = sp_playlistcontainer_add_new_playlist(SpotifySession::getInstance()->PlaylistContainer(), playlistname.toLocal8Bit());
    sp_playlist_add_callbacks( playlist, &SpotifyCallbacks::playlistCallbacks, this);
    qDebug() << "Created playlist!";

//     AddTracksData addData;
//     addData.pl.playlist_ = playlist;
//     addData.pos = 0;
//
//     if( playlist != NULL && sp_playlist_is_loaded( playlist ) ){
//
//         foreach( QVariant track, data.value( "tracklist").toList() )
//         {
//             artist = track.toMap().value( "artist" ).toString();
//             title = track.toMap().value( "track" ).toString();
//             album = track.toMap().value( "album" ).toString();
//
//             QString query = QString(artist + " " + title + " " + album);
//             sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, &SpotifySearch::addSearchedTrack, &addData );
//             addData.pos++;
//         }

//     }
//     else
//     {
//         qDebug() << "Failed to create new playlist!";
//         return;
//     }

}

/**
  Create a playlist with, or without data
  which appends to spotify container

    QVariantMap data;
    data[ "playlistname" ] = "ewplaylist";
    data[ "trackcount" ] = 1;
    QVariantList trackList;
    QVariantMap track;
    track[ "artist" ] = "Madonna";
    track[ "track" ] = "Like a virgin";
    trackList << track;
    data[ "tracklist" ] = trackList;

    addNewPlaylist( data );
  **/
void
SpotifyPlaylists::addTracksToSpotifyPlaylist( QVariantMap data )
{
    qDebug() << "Adding tracks to playlist with id " << data.value( "playlistid");

    QString playlistId = data.value( "playlistid").toString();
    LoadedPlaylist loader;
    loader.id_ = data.value("playlistid").toString();
    const int index = m_playlists.indexOf( loader );

    if ( index == -1 )
    {
        qWarning() << "Asked to add tracks to a spotify playlist that doesn't exist!" << playlistId;
        return;
    }

    sp_playlist* pl = m_playlists[index].playlist_;

    if ( !pl || !sp_playlist_is_loaded( pl ) )
    {
        qWarning() << "Asked to add tracks to a spotify playlist that is null or is not loaded!" << pl << ( (pl != 0 ) ? (sp_playlist_is_loaded( pl ) ? "Loaded" : "Unloaded") : QString()) ;
        return;
    }

    const QVariantList tracks = data.value( "tracks").toList();

    qDebug() << "Adding tracks to playlist " << sp_playlist_name( pl );
    int position = -1;

    const QString trackId = data.value( "startPosition" ).toString();
    if ( !trackId.isEmpty() )
    {
        sp_link* link = sp_link_create_from_string( trackId.toUtf8().constData() );
        if ( sp_link_type( link ) == SP_LINKTYPE_TRACK )
        {
            sp_track* targetTrack = sp_link_as_track( link );
            for ( int i = 0; i < m_playlists[ index ].tracks_.size(); i++ )
            {
                const sp_track* track = m_playlists[ index ].tracks_[ i ];
                if ( track == targetTrack )
                {
                    qDebug() << "Found track in playlist with associated id to use as insertion point:" << trackId << sp_track_name( targetTrack ) << sp_track_artist( targetTrack, 0 ) << "at:" << i << "out of:" << m_playlists[ index ].tracks_.size() << "tracks";
                    position = i;
                }
            }
        }
        sp_link_release( link );
    }
    position++; // Spotify wants the position to be the newly inserted pos, not the 0-based index of the track *to* insert

    if ( position == -1 )
    {
        // We didn't find the position in the playlist, or there was none, so append
        position = m_playlists[ index ].tracks_.size();
    }


    qDebug() << "Adding tracks to spotify playlist at position:" << position;

    AddTracksData* addData = new AddTracksData;
    addData->pl = m_playlists.at( index );
    addData->pos = position;
    addData->waitingFor = 0;

    foreach( QVariant track, data.value( "tracks").toList() )
    {
        const QString artist = track.toMap().value( "artist" ).toString();
        const QString title = track.toMap().value( "track" ).toString();
        const QString album = track.toMap().value( "album" ).toString();

        QString query = QString(artist + " " + title + " " + album);
#if SPOTIFY_API_VERSION >= 11
        sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, 0, 0, SP_SEARCH_STANDARD, &SpotifySearch::addSearchedTrack, addData );
#else
        sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, &SpotifySearch::addSearchedTrack, addData );
#endif
        addData->waitingFor++;

        // to help us choose the right order
        addData->origTrackNameList << title;
    }
}

/**
  Remove tracks from spotify playlist with data

    QVariantMap data;
    data[ "playlistname" ] = "newplaylist";
    data[ "spotifyId" ] = "spotify:playlist:user:asdasd";
    data[ "trackcount" ] = 1;
    QVariantList trackList;
    QVariantMap track;
    track[ "artist" ] = "Madonna";
    track[ "track" ] = "Like a virgin";
    trackList << track;
    data[ "tracklist" ] = trackList;

    removeFromSpotifyPlaylist( data );
  **/


bool
SpotifyPlaylists::removeFromSpotifyPlaylist( QVariantMap data ){

    qDebug() << "Removing tracks from playlist with id " << data.value( "playlistid");

    QString playlistId = data.value( "playlistid").toString();
    LoadedPlaylist loader;
    loader.id_ = data.value("playlistid").toString();
    int index = m_playlists.indexOf( loader );

    if ( index == -1 )
    {
        qWarning() << "Asked to remove tracks from a spotify playlist that doesn't exist!" << playlistId;
        return false;
    }

    sp_playlist* pl = m_playlists[index].playlist_;

    if ( !pl || !sp_playlist_is_loaded( pl ) )
    {
        qWarning() << "Asked to remove tracks from a spotify playlist that is null or is not loaded!" << pl << ( (pl != 0 ) ? (sp_playlist_is_loaded( pl ) ? "Loaded" : "Unloaded") : QString()) ;
        return false;
    }


    const QVariantList tracks = data.value( "tracks").toList();

    QVector<int> positions;
    positions.reserve( tracks.size() );

    foreach( QVariant track, tracks )
    {
        const QString id = track.toMap().value( "id" ).toString();
        const QString artist = track.toMap().value( "artist" ).toString();
        const QString title = track.toMap().value( "track" ).toString();
        //album = track.toMap().value( "album" ).toString();

        qDebug() << "trying to remove " << artist  << title << id;
        // case sensitive atm
        // if we have an ID, do a safe lookup and check for that. otherwrise, match metadata
        if ( !id.isEmpty() )
        {
            for(int i = 0; i < m_playlists[index].tracks_.size(); i++)
            {
                // If we have duplicates of the track to remove, don't try to remove the same thing twice.
                if ( positions.contains( i ) )
                    continue;

                char trackId[356];
                sp_track *track = m_playlists[index].tracks_[ i ];
                sp_link* l = sp_link_create_from_track( track, 0 );
                sp_link_as_string(l, trackId, sizeof(trackId));

                if( id == QString::fromAscii(trackId) )
                {
                    qDebug() << "Found track at pos" << i << " removing";
                    positions.append( i );

                    sp_link_release( l );
                    break;
                }

                sp_link_release( l );

            }
        }
        else
        {
            // No id in track, so do fuzzy matching.
            for(int i = 0; i < sp_playlist_num_tracks(pl); i++)
            {
                // If we have duplicates of the track to remove, don't try to remove the same thing twice.
                if ( positions.contains( i ) )
                    continue;

                sp_track *track = sp_playlist_track( m_playlists[index].playlist_, i);

                qDebug() << "Comparing track for removal:";
                qDebug() << title.toLower() << QString::fromUtf8( sp_track_name( track ) ).toLower();
                qDebug() << artist.toLower() << QString::fromUtf8( sp_artist_name( sp_track_artist( track, 0 ) ) ).toLower();

                if( title.toLower() == QString::fromUtf8( sp_track_name( track ) ).toLower() &&
                    artist.toLower() == QString::fromUtf8( sp_artist_name( sp_track_artist( track, 0 ) ) ).toLower() )
                {
                    qDebug() << "Found track match at pos" << i << " removing";
                    positions.append( i );

                    break;
                }

            }
        }
    }

    const QSet<int> uniq = positions.toList().toSet();
    if ( uniq.size() != positions.size() )
    {
        qWarning() << "ERROR! Found a list of positions to remove with duplicates!! This is illegal, a bug in our search algorithm! Making unique and passing along to spotify...";
        positions.clear();
        foreach( int pos, uniq )
            positions.append( pos );
    }

    qDebug() << "Was asked to remove" << tracks.size() << "tracks, found" << positions.size() << "matching";
    if ( !positions.isEmpty() )
    {
        qDebug() << "Removing found:" << positions.size() << "tracks from playlist!";

        sApp->setIgnoreNextUpdate( true );
        sp_error ret = sp_playlist_remove_tracks( pl, positions.constData(), positions.size());

        return ret == SP_ERROR_OK && tracks.size() == positions.size();

    }

    return tracks.size() == positions.size();

}

/**
  updateRevision
  Will update the revision with a timestamp
**/

void
SpotifyPlaylists::updateRevision( LoadedPlaylist &pl )
{
    qDebug() << Q_FUNC_INFO << "count" << pl.tracks_.count();
    int timestamp(0);
    for( int i = 0; i < pl.tracks_.count(); i++)
    {
        int tmpTimestamp = sp_playlist_track_create_time( pl.playlist_, i );

        if( timestamp < tmpTimestamp )
            timestamp = tmpTimestamp;

//         qDebug() << "Revision timestamp" << tmpTimestamp << "current highest timestamp" << timestamp;
    }

    /**
      @note: Todo, confirm this. Though it seems its correct.
      timestamp is 0, that means the playlist is cleared of contents, or was empty to begin with
      @note This applies if no timestamp was set from within this application, not the API
      @note Added timestamp to 0
    **/
    if( timestamp == 0 )
    {
        qDebug() << "Revision playlist was cleared from contents!";
        pl.newRev = QDateTime::currentMSecsSinceEpoch() / 1000;
    }
    else if( timestamp > pl.newRev )
    {
//         qDebug() << Q_FUNC_INFO <<  "Setting new revision " << timestamp <<  "Old rev: " << pl.oldRev;
        // Hash later with appropriate hash algorithm.
        pl.oldRev = pl.newRev;
        pl.newRev = timestamp;

    }


}

/**
  updateRevision with qualifier
  Will update the revision with a hashed qualifier
**/
void
SpotifyPlaylists::updateRevision( LoadedPlaylist &pl, int qualifier )
{
//     qDebug() << Q_FUNC_INFO << "Qualifier " << qualifier << "rev " << pl.oldRev;
    if( qualifier > pl.newRev)
    {
//         qDebug() << "Setting new revision " << qualifier <<  "Old rev: " << pl.oldRev;

        RevisionChanges oldRev;
        oldRev.revId = pl.oldRev;

        RevisionChanges revision;
        revision.revId = pl.newRev;

        int revIndex = pl.revisions.indexOf( oldRev );

//         if( revision.revId != -1 )
//         {
//
//             for(int i = 0; i < sp_playlist_num_tracks( pl.playlist_ )-1; i++)
//             {
//                 foreach( sp_track* track, pl.revisions[ revIndex ].changedTracks )
//                 {
//                     if( sp_track_name( track ) != sp_track_name(sp_playlist_track(pl.playlist_, i) ) )
//                     {
//                         if(!revision.changedTracks.contains( track )){
//                             qDebug() << "changed track" << sp_track_name(sp_playlist_track(pl.playlist_, i));
//                             revision.changedTracks.in sert(i, track);
//                         }
//
//                     }
//                 }
//             }
//         }else
//             revision.changedTracks = pl.tracks_;


        ///   @todo:Hash later with appropriate hash algorithm.
        ///   @note: we try and keep all the revision, these should be cached
        ///          for next start

        pl.revisions.append( revision );
        pl.oldRev = pl.newRev;
        pl.newRev = qualifier;
    }
}

void
SpotifyPlaylists::playlistLoadedSlot(sp_playlist* pl)
{
    qDebug() << Q_FUNC_INFO << "Got playlist loaded that we were waiting for, now we have:" << m_waitingToLoad << "left";
    addPlaylist(pl);

    checkForPlaylistsLoaded();
}


void
SpotifyPlaylists::checkForPlaylistsLoaded()
{
    if(m_waitingToLoad.isEmpty())
    {
        qDebug() << "========== GOT ALL PLAYLISTS LOADED, EMITTING SIGNAL!";
        m_isLoading = false;
        m_allLoaded = true;
        emit notifyContainerLoadedSignal();
    }
}


/**
 addPlaylist( sp_playlist *)
   This function is called from callback
   This will also fire if and of the playlist callbacks is called,
   thus updateing the list-eg. if any track is moved, it will rearange the order.
**/
void
SpotifyPlaylists::addPlaylist( sp_playlist *pl )
{
//     qDebug() << "addPlaylist from thread id" << thread()->currentThreadId();
    if( !pl){
        qDebug() << Q_FUNC_INFO << "Pl was null";
        return;
    }

    if( !sp_playlist_is_loaded( pl ) ){
        qDebug() << Q_FUNC_INFO << "Pl isnt loaded";
        return;
    }

//     qDebug() << "Playlist has " << sp_playlist_num_tracks( pl ) << " number of tracks";

    m_waitingToLoad.removeAll( pl );

    LoadedPlaylist playlist;

    // Get the spotify id for the playlist
    char linkStr[256];
    sp_link *pl_link = sp_link_create_from_playlist( pl );
    if( pl_link ){

        sp_link_as_string( pl_link, linkStr, sizeof(linkStr));
        sp_link_release( pl_link );

        playlist.id_ = linkStr;
    }
    else
    {

        ///    Due to reasons in the playlist backend design and the Spotify URI scheme you need to
        ///    wait for the playlist to be loaded before you can successfully construct an URI.
        ///    If sp_link_create_from_playlist() returns NULL, try again after teh playlist_state_changed callback has fired
        ///    @author Spotify dev

        ///    Will be added at next state change

        qDebug() << "Failed to get URI! Aborting...";
        return;
    }

    // if it's already loaded, ignore it!
    if ( m_playlists.indexOf( playlist ) >= 0 && m_playlists[ m_playlists.indexOf( playlist ) ].isLoaded )
        return;

    playlist.playlist_ = pl;
    playlist.name_ = sp_playlist_name(pl);

    playlist.starContainer_ = false;
    playlist.sync_ = false;
    playlist.isLoaded = false;

    int tmpRev(0);


    /*if(m_playlists.contains( playlist ) )
    {
        qDebug() << "List allready contains the playlist";
        return;
    }*/

    if( playlist.id_.contains( "0000000000000000000000" ) )
    {
        qDebug() << "Marking starred track playlist" << pl;
        playlist.name_ =  "Starred Tracks";
        playlist.starContainer_ = true;
    }

    qDebug() << "Adding " << sp_playlist_num_tracks( playlist.playlist_ ) << "tracks to our LoadedPlaylist object for" << playlist.name_;
    for ( int i=0 ; i< sp_playlist_num_tracks( playlist.playlist_ ); ++i )
    {

        sp_track* track = sp_playlist_track( pl, i );
        sp_track_add_ref( track );
        // Set revision on initation
        int timestamp = sp_playlist_track_create_time( pl, i);
//             qDebug() << "Timestamp " << timestamp;
        if( tmpRev < timestamp)
            tmpRev = timestamp;

        playlist.tracks_.push_back( track );
    }

//         qDebug() << "Updateing revision with " << tmpRev;
    // Revision, initially -1
    playlist.oldRev = -1;
    playlist.newRev = -1;

    updateRevision( playlist, tmpRev );

//         qDebug() << "RevId" << playlist.newRev;

    // Playlist is loaded and ready
    playlist.isLoaded = true;

    if(m_playlists.contains( playlist ) )
    {
        int index = m_playlists.indexOf( playlist );
        if( index != -1 )
                m_playlists.replace(index, playlist);
    }
    else
        m_playlists.append( playlist );


        /// Initially, when reading QSettings for syncPlaylists
        /// we cant set the callbacks directly, as they are not loaded yet.
        /// This will add sync callbacks for the loaded playlists,

    Sync syncThis;
    syncThis.id_ = playlist.id_;
    if( m_syncPlaylists.contains( syncThis ) )
    {
        qDebug() << "Adding syncing for  playlist " << playlist.id_;
        setSyncPlaylist( playlist.id_, true );
    }
}

void SpotifyPlaylists::ensurePlaylistsLoadedTimerFired()
{
    if ( m_waitingToLoad.isEmpty() )
        return;

    bool workToDo = false;
    QList< sp_playlist* > toCheck = m_waitingToLoad; // addPlaylist will modify m_waitingToLoad
    for ( int i = 0; i < toCheck.size(); i++ )
    {
        if ( sp_playlist_is_loaded( toCheck[ i ] ) )
        {
            qDebug() << "Delayed find of playlist that is actually loaded... adding";
            addPlaylist( toCheck[ i ] );
        } else {
            workToDo = true;
        }
    }

    if ( workToDo )
    {
        qDebug() << "Checked for all playlists loaded, but not all are yet! Refiring timer";
        m_checkPlaylistsTimer->start();
    }

    checkForPlaylistsLoaded();
}

/**
  operator==
**/
bool operator==(SpotifyPlaylists::LoadedPlaylist one, SpotifyPlaylists::LoadedPlaylist two)
{
    if(one.id_ == two.id_)
        return true;
    if( one.playlist_ == two.playlist_)
        return true;
    return false;
}
bool operator==(SpotifyPlaylists::Sync one, SpotifyPlaylists::Sync two)
{
    if(one.id_ == two.id_)
        return true;
    return false;
}
bool operator==(SpotifyPlaylists::RevisionChanges one, SpotifyPlaylists::RevisionChanges two)
{
    if(one.revId == two.revId)
        return true;
    return false;
}

