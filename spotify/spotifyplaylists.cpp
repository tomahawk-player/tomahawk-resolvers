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
#include <QObject>
#include <QThread>
#include <QDateTime>
#include <QTimer>

SpotifyPlaylists::SpotifyPlaylists( QObject *parent )
   : QObject( parent )
   , m_waitingToLoad( 0 )
   , m_allLoaded( false )
   , m_isLoading( false )
{
    qDebug() << "Starting playlists in thread id" << thread()->currentThreadId();
    /**
      Metatypes for invokeMethod
      **/
    qRegisterMetaType< sp_playlist* >("sp_playlist*");
    qRegisterMetaType< int* >("int*");
    qRegisterMetaType< QVariantMap >("QVariantMap");
    qRegisterMetaType< sp_playlistcontainer* >("sp_playlist_continer*");
    qRegisterMetaType< SpotifyPlaylists::LoadedPlaylist >("SpotifyPlaylists::LoadedPlaylist");

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
    m_settings.beginWriteArray("syncPlaylists");
    // Clear settings?
    // settings.clear();
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
//     qDebug() << "Callback on thread" << _playlists->thread()->currentThreadId();

    // If the playlist isn't loaded yet we have to wait

    if ( !sp_playlist_is_loaded( pl ) )
    {
//       qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }
    else
    {
//         qDebug() << "Invoking addPlaylist from thread id" << _playlists->thread()->currentThreadId();

        // if it was just loaded and we don't have it yet, add it
        LoadedPlaylist playlist;
        playlist.playlist_ = pl;
        const int index = _playlists->m_playlists.indexOf( playlist );
        if ( index == -1 )
            QMetaObject::invokeMethod( _playlists, "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl) );
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
        m_waitingToLoad = 0;

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
                sp_playlist_add_callbacks( pl, &SpotifyCallbacks::playlistCallbacks, SpotifySession::getInstance()->Playlists() );

                qDebug() << "Adding playlist:" << pl << sp_playlist_is_loaded( pl ) << sp_playlist_name( pl ) << sp_playlist_num_tracks( pl );
                if ( sp_playlist_is_loaded( pl ) )
                    addPlaylist( pl );
                else
                    m_waitingToLoad++;
            }
        }

        checkForPlaylistsLoaded();
        // Add starredTracks, should be an option

        SpotifySession::getInstance()->setPlaylistContainer( pc );

    }else
    {
        qWarning() << "loadContainerSlot called twice! SOMETHING IS WRONG!!";
    }

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

    QMetaObject::invokeMethod( _playlists, "addTracks", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(sp_track * const *, tracks), Q_ARG(int, num_tracks), Q_ARG(int, position) );
}



/**
   addTracks(sp_playlist*, sp_tracks * const *tracks, int num_tracks)
   This is called from callback to add tracks to this playlist container
**/
void
SpotifyPlaylists::addTracks(sp_playlist* pl, sp_track *const*tracks, int num_tracks, int pos)
{
    qDebug() << "Adding tracks to" << sp_playlist_name(pl);

    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = m_playlists.indexOf( playlist );
    if( index != -1 ) {

        for ( int i=0 ; i< num_tracks; ++i )
        {
            qDebug() << "Pos" << pos;
            sp_track* track = *(tracks++);
            qDebug() << "Adding track " << i << sp_track_name( track );
            sp_track_add_ref( track );
            m_playlists[index].tracks_.insert(pos, track );
            pos++;
        }
        //qDebug() << "Playlist changed, updateing revision";
        updateRevision( m_playlists[index] );

    }

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
SpotifyPlaylists::removeTracks(sp_playlist* pl, int *tracks, int num_tracks)
{

    qDebug() << "Removing tracks in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );
    if( index != -1 ){

        if( num_tracks == m_playlists[index].tracks_.count() )
            m_playlists[index].tracks_.clear();

        for ( int i=0 ; i< num_tracks; ++i )
        {
            int pos = *(tracks)++;
            qDebug() << "Removing track at" << pos;
            m_playlists[index].tracks_.removeAt( pos );
        }
        // We need to update the revision with current timestamp
        int timestamp =  QDateTime::currentMSecsSinceEpoch() / 1000;
//         qDebug() << "Updateing revision with removetrack timestamp " << timestamp;
        updateRevision( m_playlists[index], timestamp );
    }

}

/**
    moveTracks(sp_playlist* pl, const int *tracks, int num_tracks, int new_position)
    called from callback
**/

void
SpotifyPlaylists::moveTracks(sp_playlist* pl, int *tracks, int num_tracks, int new_position)
{

    qDebug() << "Moving tracks in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );
    if( index != -1 && sp_playlist_is_loaded( m_playlists[index].playlist_ ) )
    {
        for(int i = 0; i < num_tracks-1; i++)
        {
            qDebug() << "Moving track nr" << i << "at pos " << *(tracks++) << " to pos" << new_position;
            m_playlists[index].tracks_.move(tracks[i], new_position++);
        }

        qDebug() << "Tracks moved";
        // We need to update the revision with current timestamp
        int timestamp =  QDateTime::currentMSecsSinceEpoch() / 1000;
        qDebug() << "Updateing revision with move track timestamp " << timestamp;

        updateRevision( m_playlists[index], timestamp );

    }
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
    qDebug() << "Setting sync for " << id;
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
            sp_playlist_add_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
        }
        // The playlist is in syncmode, but user wants to remove it
        else if( syncIndex != -1 && !sync )
        {
            m_syncPlaylists.removeAt( index );
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
    qDebug() << "Tracks removed";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    int *tracksList = new int[num_tracks];
    for (int i = 0; i < num_tracks; i++)
        tracksList[i] = tracks[i];

    qDebug() << "Invoking remove from thread id" << _playlists->thread()->currentThreadId();
    QMetaObject::invokeMethod( _playlists, "removeTracks", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(int*, tracksList), Q_ARG(int, num_tracks) );

    delete []tracksList;
}

/**
  tracksMoved
  **/
void SpotifyPlaylists::tracksMoved(sp_playlist *playlist, const int *tracks, int num_tracks, int new_position, void *userdata)
{

    qDebug() << "Tracks moved";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    int *tracksList = new int[num_tracks];
    for (int i = 0; i < num_tracks; i++)
        tracksList[i] = tracks[i];

    QMetaObject::invokeMethod( _playlists, "moveTracks", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(int*, tracksList), Q_ARG(int, num_tracks), Q_ARG(int, new_position) );

    delete []tracksList;
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
//     qDebug() << "In Progress in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );

    if( index != -1 ){
        qDebug() << "Playlist progress is" << (done ? "done" : "still loading..." ) << index << "(" << sp_playlist_name(pl) << ")";
        m_playlists[ index ].isLoaded = done;
        if( done && m_playlists[index].sync_)
        {
            // Sometimes, the api will send the playlist twice, dont do this
            // if its allready been sent.

            if( m_playlists[ index ].sentRev != m_playlists[ index ].newRev ){
                m_playlists[ index ].sentRev = m_playlists[ index ].newRev;
//                foreach( RevisionChanges changes, m_playlists[index].revisions)
//                    qDebug() << "Revision id " << changes.revId;
                doSend( m_playlists[ index ] );
            }
        }
    }


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

    AddTracksData addData;
    addData.pl.playlist_ = playlist;
    addData.pos = 0;

    if( playlist != NULL && sp_playlist_is_loaded( playlist ) ){

        foreach( QVariant track, data.value( "tracklist").toList() )
        {
            artist = track.toMap().value( "artist" ).toString();
            title = track.toMap().value( "track" ).toString();
            album = track.toMap().value( "album" ).toString();

            QString query = QString(artist + " " + title + " " + album);
            sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, &SpotifySearch::addSearchedTrack, &addData );
            addData.pos++;
        }

    }
    else
    {
        qDebug() << "Failed to create new playlist!";
        return;
    }

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
SpotifyPlaylists::addTracksToSpotifyPlaylist( QVariantMap data, const int pos, LoadedPlaylist pl )
{

    qDebug() << "Adding tracks to playlist " << pl.name_;
    QString artist, title, album;

    AddTracksData addData;
    addData.pl = pl;
    addData.pos = pos;

    if( pl.playlist_ != NULL && sp_playlist_is_loaded( pl.playlist_ ) )
    {
        foreach( QVariant track, data.value( "tracklist").toList() )
        {
            artist = track.toMap().value( "artist" ).toString();
            title = track.toMap().value( "track" ).toString();
            album = track.toMap().value( "album" ).toString();

            QString query = QString(artist + " " + title + " " + album);
            sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, &SpotifySearch::addSearchedTrack, &addData );
            addData.pos++;
        }

    }
    else
    {
        qDebug() << "Failed to add tracks to playlist!";
        return;
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


void
SpotifyPlaylists::removeFromSpotifyPlaylist( QVariantMap data ){

    qDebug() << "Removing tracks from playlist with name " << data.value( "playlistname");
    QString artist, title, album, playlistname;

    playlistname = data.value( "playlistname").toString();
    LoadedPlaylist pl;
    pl.id_ = data.value("spotifyId").toString();
    int index = m_playlists.indexOf( pl );

    if( index != -1 ){

        qDebug() << "Found playlist to remove from!";

        int count(0);

        if( m_playlists[index].playlist_ != NULL && sp_playlist_is_loaded( m_playlists[index].playlist_ ) ){

            /**
              @todo: Fix dynamic alloclation for pos!
              **/
            int *pos = new int[10];

            foreach( QVariant track, data.value( "tracklist").toList() )
            {
                artist = track.toMap().value( "artist" ).toString();
                title = track.toMap().value( "track" ).toString();
                //album = track.toMap().value( "album" ).toString();
                qDebug() << "trying to remove " << artist  << title;
                // case sensitive atm
                for(int i = 0; i < sp_playlist_num_tracks( m_playlists[index].playlist_); i++)
                {
                    sp_track *track = sp_playlist_track( m_playlists[index].playlist_, i);
                    if( title.toLower() == QString::fromUtf8( sp_track_name( track ) ).toLower() &&
                        artist.toLower() == QString::fromUtf8( sp_artist_name( sp_track_artist( track, 0 ) ) ).toLower() )
                    {
                        qDebug() << "Found track at pos" << i << " removing";
                        pos[0] = i;
                        count++;
                    }

                }
            }

            for(int j = 0; j < count; j++)
                qDebug() << "Found tracks to remove at " << pos[j];

            // Doesnt seem to work atm
             sp_playlist_remove_tracks( m_playlists[index].playlist_, pos, count);
             delete []pos;

        }
        else
        {
            qDebug() << "Failed to remove from playlist!";
            return;
        }
    }else
        qDebug() << "Cant find playlist";
    return;

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

        if( revision.revId != -1 )
        {

            for(int i = 0; i < sp_playlist_num_tracks( pl.playlist_ )-1; i++)
            {
                foreach( sp_track* track, pl.revisions[ revIndex ].changedTracks )
                {
                    if( sp_track_name( track ) != sp_track_name(sp_playlist_track(pl.playlist_, i) ) )
                    {
                        if(!revision.changedTracks.contains( track )){
                            qDebug() << "changed track" << sp_track_name(sp_playlist_track(pl.playlist_, i));
                            revision.changedTracks.insert(i, track);
                        }

                    }
                }
            }
        }else
            revision.changedTracks = pl.tracks_;


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
    m_waitingToLoad--;
    addPlaylist(pl);
    qDebug() << Q_FUNC_INFO << "Got playlist loaded that we were waiting for, now we have:" << m_waitingToLoad << "left";

    checkForPlaylistsLoaded();
}


void
SpotifyPlaylists::checkForPlaylistsLoaded()
{
    if(m_waitingToLoad == 0)
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


    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    playlist.name_ = sp_playlist_name(pl);

    playlist.starContainer_ = false;
    playlist.sync_ = false;
    playlist.isLoaded = false;

    int tmpRev(0);

    // Get the spotify id for the playlist
    char linkStr[256];
    sp_link *pl_link = sp_link_create_from_playlist( pl );
    if( pl_link ){

        sp_link_as_string( pl_link, linkStr, sizeof(linkStr));
        sp_link_release( pl_link );

        qDebug() << "Got SP LINK for playlist:" << sp_playlist_name(pl) << linkStr;
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

