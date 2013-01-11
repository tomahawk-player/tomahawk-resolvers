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

#include "callbacks.h"
#include "PlaylistClosure.h"
#include "spotifyresolver.h"
#include <QCryptographicHash>
#include <QApplication>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QFileInfoList>

SpotifyPlaylists::SpotifyPlaylists( QObject *parent )
   : QObject( parent )
   , m_loadTimer( new QTimer( this ) )
   , m_checkPlaylistsTimer( new QTimer( this ) )
   , m_periodicTimer( new QTimer( this ) )
   , m_allLoaded( false )
   , m_isLoading( false )
{
    /**
      Metatypes for invokeMethod
      **/
    qRegisterMetaType< sp_playlist* >("sp_playlist*");
    qRegisterMetaType< int* >("int*");
    qRegisterMetaType< QVariantMap >("QVariantMap");
    qRegisterMetaType< sp_playlistcontainer* >("sp_playlistcontainer*");
    qRegisterMetaType< SpotifyPlaylists::LoadedPlaylist >("SpotifyPlaylists::LoadedPlaylist");
    qRegisterMetaType< QList<sp_track* > >("QList<sp_track*>");
    qRegisterMetaType< QList<int> >("QList<int>");

    m_checkPlaylistsTimer->setInterval( 2000 );
    m_checkPlaylistsTimer->setSingleShot( true );
    connect( m_checkPlaylistsTimer, SIGNAL( timeout() ), this, SLOT( ensurePlaylistsLoadedTimerFired() ) );

    m_periodicTimer->setInterval( 500 );
    connect( m_periodicTimer, SIGNAL( timeout() ), this, SLOT( checkWaitingForLoads() ) );
    m_periodicTimer->start();

    readSettings();
}



/**
    Read the QSettings to set the sync states from previous settings
**/

void
SpotifyPlaylists::readSettings()
{
    QString user = m_settings.value( "username" ).toString();
    int size = m_settings.beginReadArray( "syncPlaylists" );

    for ( int i = 0; i < size; ++i )
    {
         m_settings.setArrayIndex( i );
         Sync sync;
         if( !m_settings.value( "user" ).toString().isEmpty() && m_settings.value( "user" ).toString() == user )
         {
             sync.id_ = m_settings.value( "id" ).toString();
             qDebug() << Q_FUNC_INFO << "Loading playlist to sync:" << sync.id_ << "from user " << m_settings.value( "user" ).toString();
             sync.sync_ = m_settings.value( "sync" ).toBool();
             m_syncPlaylists.append( sync );
         }

    }

    m_settings.endArray();
}


void
SpotifyPlaylists::writeSettings()
{
    // Rewrite settings
    QString user = m_settings.value( "username" ).toString();
    m_settings.remove( "syncPlaylists" );
    m_settings.beginWriteArray("syncPlaylists");;
    for ( int i = 0; i < m_syncPlaylists.size(); ++i )
    {
        m_settings.setArrayIndex( i );
        m_settings.setValue( "user" , user);
        m_settings.setValue( "id" , m_syncPlaylists.at( i ).id_ );
        m_settings.setValue( "sync" , m_syncPlaylists.at( i ).sync_ );
    }
    m_settings.endArray();
}


void SpotifyPlaylists::clear()
{
    qDebug() << "Destroying playlists";
    writeSettings();
    m_settings.sync();
    for ( int i = 0; i < m_playlists.size(); i++ )
    {
        foreach ( sp_track* track, m_playlists[ i ].tracks_ )
            sp_track_release( track );

        Sync s;
        s.id_ = m_playlists[ i ].id_;
        const bool sync = m_syncPlaylists.contains( s );

        if ( sync )
            sp_playlist_remove_callbacks( m_playlists[ i ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
        else
            sp_playlist_remove_callbacks( m_playlists[ i ].playlist_, &SpotifyCallbacks::playlistCallbacks, this);

        sp_playlist_release( m_playlists[ i ].playlist_ );
    }
    m_playlists.clear();
    m_syncPlaylists.clear();
    m_stateChangedCallbacks.clear();
}

/**
  Destructor
    This destructor is important.
    It removes callbacks and frees playlists and its tracks
**/

SpotifyPlaylists::~SpotifyPlaylists()
{
    clear();
}


/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
    Will keep trying to add a playlist if its not in the list
    If the playlist isn't loaded yet we have to wait
**/
void
SpotifyPlaylists::stateChanged( sp_playlist* pl, void* userdata )
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
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
        sp_playlist_update_subscribers( SpotifySession::getInstance()->Session(), pl );
        const int index = _playlists->m_playlists.indexOf( playlist );
        if ( index == -1 )
        {
//            qDebug() << Q_FUNC_INFO << "Invoking addPlaylist from stateChanged callback as playlist is not in our list!";
            if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
                QMetaObject::invokeMethod( _playlists, "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl) );
            else
                _playlists->addPlaylist( pl );
        }
    }
}


/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
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

    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = _playlists->m_playlists.indexOf( playlist );
    if ( index == -1 )
    {
        qWarning() << "Got stateChanged for syncplaylist, but isnt in our list!";
        return;
    }

    sp_playlist_update_subscribers( SpotifySession::getInstance()->Session(), pl );

    bool collab = sp_playlist_is_collaborative( pl );

    if( collab != _playlists->m_playlists[ index ].isCollaborative )
    {
        qDebug() << "Collaborative changed, sending";
        _playlists->m_playlists[ index ].isCollaborative = collab;
        emit _playlists->notifyCollaborativeChanged( _playlists->m_playlists[ index ] );
    }

}

void
SpotifyPlaylists::subscribersChanged( sp_playlist *pl, void *userdata )
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = _playlists->m_playlists.indexOf( playlist );
    if ( index == -1 )
    {
        qWarning() << "Got subscribersChanged for syncplaylist, but isnt in our list!";
        return;
    }

    int subCount = sp_playlist_num_subscribers( pl );
    if( subCount != _playlists->m_playlists[ index ].numSubscribers )
    {
        qDebug() << "Number of subscribers changed, sending!";
        _playlists->m_playlists[ index ].numSubscribers = sp_playlist_num_subscribers( pl );
        emit _playlists->notifySubscriberCountChanged( _playlists->m_playlists[ index ] );
    }
}

void
SpotifyPlaylists::playlistRenamed(sp_playlist *pl, void *userdata)
{
    qDebug() << "Playlist renamned to " << sp_playlist_name( pl );
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    _playlists->playlistNameChange( pl );
}

void
SpotifyPlaylists::playlistMetadataUpdated( sp_playlist *pl, void *userdata )
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    sp_playlist_update_subscribers( SpotifySession::getInstance()->Session(), pl );
    _playlists->checkForPlaylistCallbacks( pl, userdata );
}

void
SpotifyPlaylists::checkForPlaylistCallbacks( sp_playlist *, void * )
{
    // If we care about this state changed b/c we have a callback registered, fire it
    foreach ( PlaylistClosure* callback, m_stateChangedCallbacks )
    {
        if ( callback->conditionSatisfied() )
        {
//            qDebug() << "Callback condition satisfied, all systems go!";
            // Callback is ready to fire, cap'n!
            callback->invoke();
            m_stateChangedCallbacks.removeAll( callback );
            delete callback;
        }
    }
}

/**
  checkWaitingForLoads
  Periodic check for tracks waiting to load
  **/
void
SpotifyPlaylists::checkWaitingForLoads()
{
    if ( m_stateChangedCallbacks.isEmpty() )
        return;

//    qDebug() << "Periodic check for tracks waiting to load....";
    foreach ( const LoadedPlaylist& pl, m_playlists )
    {
        checkForPlaylistCallbacks( pl.playlist_, this );
    }
}


/**
  getPlaylistFromUri
  returns a playlist from qstring
  **/
sp_playlist * SpotifyPlaylists::getPlaylistFromUri(const QString &uri)
{

    sp_link *plink = sp_link_create_from_string( uri.toLocal8Bit() );
    if ( !plink )
    {
        qDebug() << "Playlist link is not a spotify link";
        return NULL;
    }

    if ( sp_link_type( plink ) != SP_LINKTYPE_PLAYLIST )
    {
        qDebug() << "Playlist link is not a valid spotify link";
        sp_link_release( plink );
        return NULL;
    }
    sp_playlist *playlist = sp_playlist_create(SpotifySession::getInstance()->Session(), plink);
    sp_link_release( plink );
    return playlist;

}

/**
  setSubscribedPlaylist
  Takes QString uri, to add a subscribed playlist to container.
  it will be added to synclist + subscribedlist
  **/
void SpotifyPlaylists::setSubscribedPlaylist(const QString &playlistUri, bool subscribe )
{
    sp_playlist *playlist = getPlaylistFromUri( playlistUri );
    if( !sp_playlist_is_loaded( playlist ) )
    {
        addStateChangedCallback( NewPlaylistClosure( boost::bind(checkPlaylistIsLoaded, playlist), this, SLOT( setSubscribedPlaylist(const QString&, bool) ), playlistUri, subscribe) );
        return;
    }

    LoadedPlaylist lpl;
    lpl.playlist_ = playlist;
    lpl.id_ = playlistUri;

    if( m_playlists.contains( lpl ) )
    {
        int index = m_playlists.indexOf( lpl );
        if( index != -1 )
        {
            if( m_playlists[ index ].isSubscribed && !subscribe )
            {
                qDebug() << "Removing subscription!";
                removeSubscribedPlaylist( m_playlists[ index ].playlist_ );
            }
            else
            {
                qDebug() << "Playlist isnt subscribed but in our list?!"
                         << subscribe <<  m_playlists[ index ].id_ <<  m_playlists[ index ].isCollaborative
                         <<  m_playlists[ index ].isLoaded <<  m_playlists[ index ].isSubscribed
                         <<  m_playlists[ index ].name_;
            }
        }
        return;
    }

    if( subscribe )
    {
        // Hard to set isSubscribed through playlist_added callback, as it doesnt accept userdata from here
        addPlaylist( playlist, true, true );
        /// @note we can subscribe on a non collaborative pl as well
        sp_playlistcontainer_add_playlist( SpotifySession::getInstance()->PlaylistContainer(), sp_link_create_from_string( playlistUri.toUtf8() ) );
        sp_playlist_update_subscribers( SpotifySession::getInstance()->Session(), playlist );
    }
    else
    {
        qWarning() << "Asked to unsubscribe a playlist we don't know about!" << playlistUri;
    }
}


/**
  removeSubscribedPlaylist
  **/
void SpotifyPlaylists::removeSubscribedPlaylist( sp_playlist* playlist )
{
    qDebug() << Q_FUNC_INFO;
    LoadedPlaylist lpl;
    lpl.playlist_ = playlist;

    if( !m_playlists.contains( lpl ) )
        return;

    int index;
    index = m_playlists.indexOf( lpl );
    if( index != -1 )
    {

        if( m_playlists[ index ].isSubscribed )
        {
            qDebug() << "Removing subscription";
            doRemovePlaylist( playlist );
        }

    }

}

/**
  setCollaborative
    sets collaborative state for playlist
  **/
void SpotifyPlaylists::setCollaborative(const QString &playlistUri, bool collab )
{
    qDebug() << Q_FUNC_INFO;
    LoadedPlaylist lpl;
    lpl.id_ = playlistUri;

    if( !m_playlists.contains( lpl ) ){
        qDebug() << "Failed to set collbab for " << playlistUri << " not in playlistMap!";
        return;
    }
    int index;
    index = m_playlists.indexOf( lpl );
    if( index != -1 )
    {
        lpl = m_playlists[ index ];
        // set_collaborative is void function, so check if the user can set the state on this uri
        QString username = QString::fromLatin1(sp_user_canonical_name( sp_session_user( SpotifySession::getInstance()->Session() ) ) );
        if( lpl.isLoaded )
        {
            if( username == lpl.owner_ )
            {
                qDebug() << "Setting collab!" << collab;
                sp_playlist_set_collaborative(lpl.playlist_, collab );

            }else
                qDebug() << "ERROR: This user doesnt have access to modify this playlist";
        }else
            qDebug() << "Error, playlist isnt loaded! hmhmhm";
    }

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


/**
  signal doSend
  will send a LoadedPlaylist
  **/
void SpotifyPlaylists::doSend( const SpotifyPlaylists::LoadedPlaylist& playlist )
{
    if( !sp_playlist_is_loaded( playlist.playlist_) )
        return;

    qDebug() << "Sending " << sp_playlist_name( playlist.playlist_ ) << "playlist to client with:" << sp_playlist_num_tracks( playlist.playlist_ );
    emit( sendLoadedPlaylist( playlist ) );
}


/**
  Callback
    State changed
    Called from libspotify when a sp_playlistcontainer is loaded
**/

void
SpotifyPlaylists::playlistContainerLoadedCallback( sp_playlistcontainer* pc, void* userdata)
{
    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );
    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _session->Playlists(), "loadContainerSlot", Qt::QueuedConnection, Q_ARG(sp_playlistcontainer*, pc) );
    else
        _session->Playlists()->loadContainerSlot( pc );

}

/**
  loadedContainerSlot
  this is invoked from callback when container is loaded
  should be once per session/user
  **/
void
SpotifyPlaylists::loadContainerSlot(sp_playlistcontainer *pc){

    qDebug() << Q_FUNC_INFO;
    if( !m_allLoaded && !m_isLoading )
    {
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

                //qDebug() << "Adding playlist:" << pl << sp_playlist_is_loaded( pl ) << sp_playlist_name( pl ) << sp_playlist_num_tracks( pl );
                if ( sp_playlist_is_loaded( pl ) )
                    addPlaylist( pl );
                else
                    m_waitingToLoad << pl;
            }
        }

        /// Add starredTracks, should be an option
        /// @note we need to wait for the starred list as well
        addStarredTracksToContainer();
        checkForPlaylistsLoaded();

    }

    m_checkPlaylistsTimer->start();
}

/**
  playlistNameChange
  called from callback
  **/
void
SpotifyPlaylists::playlistNameChange(sp_playlist *pl )
{

    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = m_playlists.indexOf( playlist );

    if( index == -1 )
    {
        qWarning() << "Renamed a playlist we don't know about? WTF!" << ( QString::fromUtf8(sp_playlist_name( pl )).isEmpty() ? "empty name " : sp_playlist_name( pl ) );
        return;
    }

    qDebug() << "Renamning " << m_playlists[index].name_ << " to " << sp_playlist_name( pl );
    m_playlists[index].name_ = QString::fromUtf8( sp_playlist_name( pl ) );

    // container update, send signal, notify name change
    emit notifyContainerLoadedSignal();
    const SpotifyPlaylists::LoadedPlaylist send = m_playlists[index];
    emit notifyNameChange( send );

}

/**
  addStarredTracksContainer()
  This creates the starred tracks playlist, and will automatically add it to the synclist
  The starredTracks container is not a playlist and has no name. But it has a special uri
  and that uri is changed in v11
**/
void
SpotifyPlaylists::addStarredTracksToContainer()
{

    sp_playlist* starredTracks = sp_session_starred_create( SpotifySession::getInstance()->Session() );
    qDebug() << "Created starred playlist:" << starredTracks;

    if ( sp_playlist_is_loaded( starredTracks ) )
    {
        qDebug() << "Starred tracks loaded!";
        addPlaylist( starredTracks );

    }
    else
    {
        qDebug() << "Starred not loaded, adding to wait";
        m_waitingToLoad << starredTracks;
    }


}

/**
  waitForLoad ( sp_playlist * )
  convenient way to wait for a playlist
  **/
void
SpotifyPlaylists::waitForLoad( sp_playlist *playlist )
{
    if ( sp_playlist_is_loaded( playlist ) )
    {
        qDebug() << "WaitForLoaded is loaded" << sp_playlist_name( playlist );
        addPlaylist( playlist );

    }
    else
    {
        qDebug() << "WaitForLoaded not loaded, adding to wait";
        m_waitingToLoad << playlist;
    }
    checkForPlaylistsLoaded();
}

/**
  Callback
    PlaylistAdded
    Called from libspotify when a new playlist is added
    @note, the new playlist doesnt have ANY callbacks at this state
**/

void
SpotifyPlaylists::playlistAddedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, void* userdata )
{
    QString pl;
    if ( playlist )
        pl = QString::fromUtf8( sp_playlist_name( playlist ) );
//        qDebug() << Q_FUNC_INFO << "================ IN PLAYLISTADDED CALLBACK for playlist:" << playlist << pl;

    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );

    const QString name = QString::fromUtf8( sp_playlist_name( playlist ) );
    if ( _session->Playlists()->m_playlistNameCreationToIgnore.contains( name ) )
    {
        _session->Playlists()->m_playlistNameCreationToIgnore.remove( name );
        return;
    }

    _session->Playlists()->waitForLoad( playlist );

}

/**
  Callback
    playlistMoveCallback
    Called from libspotify when posistion changed on playlist
**/

void
SpotifyPlaylists::playlistMovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, int new_position, void* userdata ) {

    qDebug() << "Playlist Moved";
    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );
    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _session->Playlists(), "setPosition", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(int, position), Q_ARG(int, new_position) );
    else
        _session->Playlists()->setPosition( playlist, position, new_position );
}

/**
  Callback
    playlistRemovedCallback
    Called from callback when playlist got removed
**/

void
SpotifyPlaylists::playlistRemovedCallback( sp_playlistcontainer* pc, sp_playlist* playlist, int position, void* userdata ) {

    Q_UNUSED( position );
    QString name;
    if ( playlist )
        name = QString::fromUtf8( sp_playlist_name( playlist ) );

    qDebug() << "Playlist removed" << playlist << name;

    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );
    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _session->Playlists(), "removePlaylistNotification", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist) );
    else
        _session->Playlists()->removePlaylistNotification( playlist );
}

/**
  Callback
    tracksAdded
    Called from libspotify when tracks where added
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

    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _playlists, "addTracksFromSpotify", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(QList<sp_track*>, trackList), Q_ARG(int, position) );
    else
        _playlists->addTracksFromSpotify( pl, trackList, position );
}


/**
  PlaylistClosure
  adds callbacks
  **/

void
SpotifyPlaylists::addStateChangedCallback( PlaylistClosure *closure )
{
//    qDebug() << "Adding state changed callback! Oh yeah....";
    m_stateChangedCallbacks << closure;
}

/**
   addTracksFromSpotify
   called from callback to add tracks from spotify
**/
void
SpotifyPlaylists::addTracksFromSpotify(sp_playlist* pl, QList<sp_track*> tracks, int pos)
{
    qDebug() << "Adding tracks to" << sp_playlist_name(pl) << "from spotify notification";
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = m_playlists.indexOf( playlist );

    if( index == -1 )
    {

        qWarning() << "Got added tracks for a playlist we don't know about? WTF!"
                   << ( QString::fromUtf8(sp_playlist_name( pl )).isEmpty() ? "empty name " : sp_playlist_name( pl ) );
        return;
    }

    // find the spotify track of the song before the newly inserted one
    const int beforePos = (pos == 0 ? 0 : pos - 1);
    char trackStr[256];
    sp_track* t = sp_playlist_track( pl, beforePos );

    if ( !t || !sp_track_is_loaded( t ) )
    {
        qWarning() << "NOTE! Got tracks inserted after a track that is not loaded or null! "
                   << beforePos << t << (t ? sp_track_is_loaded( t ) : false);
        if ( !t )
        {
            qWarning() << "TODO can't handle null tracks in playlist... how did this happen?";
            return;
        }
        else
        {
//            qDebug() << "Adding state changed callback for addPlaylist, track not loaded yet";
            QList<sp_track*> waitingFor;
            waitingFor << t;
            addStateChangedCallback( NewPlaylistClosure( boost::bind(checkTracksAreLoaded, waitingFor), this, SLOT( addTracksFromSpotify(sp_playlist*, QList<sp_track*>, int ) ), pl,  tracks, pos) );
        }

        return;
    }

    // check all tracks are loaded, if not, wait for them
    QList<sp_track*> waitingFor;
    foreach ( sp_track* t, tracks )
    {
        if ( !t )
        {
            qDebug() << "got NULL track in addTracksFromSpotify, can't handle. ignoring this track!";
            continue;
        }
        else if ( !sp_track_is_loaded(t) )
        {
            qDebug() << Q_FUNC_INFO << "Got not loaded sp_track, waiting!";
            waitingFor << t;
        }
    }

    if ( !waitingFor.isEmpty() )
    {
        // Wait!
        addStateChangedCallback( NewPlaylistClosure( boost::bind(checkTracksAreLoaded, waitingFor), this, SLOT( addTracksFromSpotify(sp_playlist*, QList<sp_track*>, int ) ), pl,  tracks, pos) );
        return;
    }

    sp_link* link = sp_link_create_from_track( t, 0 );
    sp_link_as_string( link, trackStr, sizeof( trackStr ) );
    const QString trackPosition = QString::fromUtf8( trackStr );
    sp_link_release( link );

    int runningPos = pos; // We start one before, since spotify reports the end index, not index of item to insert after
    foreach( sp_track* track, tracks )
    {
        qDebug() << "Adding track " << sp_track_name( track ) << "at pos:" << runningPos;
        sp_track_add_ref( track );
        m_playlists[index].tracks_.insert(runningPos, track );
        runningPos++;

        // This undoes the sp_track_add_ref in the addTracks callback
        sp_track_release( track );
    }

    runningPos++; // We found the track to insert after, so increase for new index
//    qDebug() << "Playlist changed, updateing revision";
    updateRevision( m_playlists[index] );

    if ( sApp->ignoreNextUpdate() )
    {
        qDebug() << "Ignoring spotify track added notification since it came from our own track insertion!";
        sApp->setIgnoreNextUpdate( false );
        return;
    }

    if( m_playlists[index].starContainer_ )
    {
        qDebug() << "Tracks where added to starContainer!";
        emit sendStarredChanged(pl, tracks, true);
        //sApp->setIgnoreNextUpdate( true );
    }

    emit sendTracksAdded(pl, tracks, trackPosition);
}


/**
  getPlaylistByRevision
  Get the playlist by last known revision,
  return empty LoadedPlaylist if non found.
**/
SpotifyPlaylists::LoadedPlaylist
SpotifyPlaylists::getPlaylistByRevision( QString revision )
{
    RevisionChanges rev;
    rev.revId = revision;

    LoadedPlaylist playlist;
    foreach( LoadedPlaylist pl, m_playlists)
    {
        if( pl.revisions.contains( rev ) )
        {
            return pl;
        }
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
/*void
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


}*/

/**
  removeTracks(sp_playlist*, const int*tracks, int num_tracks)
  This is called from callback, removes tracks from this playlist when
  changed in Spotify
**/
void
SpotifyPlaylists::removeTracksFromSpotify(sp_playlist* pl, QList<int> tracks)
{
//    qDebug() << "Removing tracks in thread id" << thread()->currentThreadId();
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
            qWarning() << "Tried to remove tracks at index:" << realIdx << "(originally" << pos
                       << ") from tracks list that is out of bounds!! We have size:" << m_playlists[index].tracks_.size();
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
        qDebug() << "removing:" << sp_track_name(remove) << sp_artist_name(sp_track_artist(remove, 0))
                 << "and actually removed:" << got;
        sp_track_release( remove );
    }

    // We need to update the revision with current timestamp
    int timestamp =  QDateTime::currentMSecsSinceEpoch() / 1000;
    updateRevision( m_playlists[index], timestamp, trackIds );

    if ( sApp->ignoreNextUpdate() )
    {
        qDebug() << "Ignoring spotify track removed notification since it came from our own track removal!";
        sApp->setIgnoreNextUpdate( false );
        return;
    }

    if( m_playlists[index].starContainer_ )
    {
        qDebug() << "Tracks where removed to starContainer!";
        emit sendStarredChanged(pl, toRemove, false);
        //sApp->setIgnoreNextUpdate( true );
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
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );
    if( index == -1 )
    {
        qWarning() << "Got moved tracks for a playlist we don't know about? WTF!" << sp_playlist_name( pl );
        return;
    }

    sp_track* beforeinsert = 0;
    if ( new_position > 0 )
    {
        if ( new_position < m_playlists[index].tracks_.size() )
        {
            beforeinsert = m_playlists[index].tracks_.at( new_position-1 );
        }
        else
        {
            qWarning() << "Bad insert position??" << "pos: " << new_position << " size: " <<  m_playlists[index].tracks_.size();
        }
    }
    qDebug() << "Moving tracks in a synced spotify playlist, from indexes:" << tracks << "to new position:" << new_position;

    // find the spotify track of the song before the newly inserted one
    const QString trackPosition = trackId( beforeinsert );

    QList<sp_track*> toInsert;
    QStringList moveIds;
    foreach( int fromPos, tracks )
    {
        int realIdx = fromPos;
        if ( fromPos == m_playlists[index].tracks_.size() )
            realIdx--;

        if ( realIdx < 0 || realIdx >= m_playlists[index].tracks_.size() )
        {
            qWarning() << "Tried to move tracks at index:" << realIdx << "(originally" << fromPos
                       << ") from tracks list that is out of bounds!! We have size:" << m_playlists[index].tracks_.size();
            continue;
        }

        toInsert << m_playlists[index].tracks_[realIdx];
        moveIds << trackId( m_playlists[index].tracks_[realIdx] );

    }

    foreach( sp_track* removing, toInsert )
        m_playlists[index].tracks_.removeAll( removing );


    int insertingPos = m_playlists[index].tracks_.indexOf( beforeinsert ) + 1;
    insertingPos = qBound<>( 0, insertingPos, m_playlists[ index ].tracks_.size() );

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


    if ( sApp->ignoreNextUpdate() )
    {
        qDebug() << "Ignoring spotify track moved notification since it came from our own track moving!";
        sApp->setIgnoreNextUpdate( false );
        return;
    }

    emit sendTracksMoved(pl, moveIds, trackPosition);
}

/**
  trackId
  returns qstring
  **/
QString
SpotifyPlaylists::trackId( sp_track* track )
{
    if ( !track )
        return QString();

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
    pl.playlist_ = 0;
    pl.id_ = id;
    int index = m_playlists.indexOf( pl );
    if( index != -1)
        return m_playlists.at( index );
    return pl;
}

/**
  setSyncPlaylist( const QString )
    sets syncflags on a playlist
    Saves state to QSettings
 **/

void
SpotifyPlaylists::setSyncPlaylist( const QString id, bool sync )
{
    LoadedPlaylist pl;
    pl.id_ = id;
//   qDebug() << "Setting sync for " << id << "to:" << sync;
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
            // during the initial load. in that case loadSettings() loaded it in m_syncPlaylists
            // but we just now loaded the real playlist from spotify, so sync it up
            if ( !m_syncPlaylists.contains( syncThis ) )
                m_syncPlaylists.append( syncThis );


            m_playlists[ index ].sync_ = true;
            // Playlist contents may have changed since we originally loaded it, so we refresh it now
            m_playlists[ index ].tracks_.clear();
            for( int i = 0; i < sp_playlist_num_tracks( m_playlists[ index ].playlist_ ); i++ )
                m_playlists[ index ].tracks_ << sp_playlist_track( m_playlists[ index ].playlist_, i );

            // We dont need to listen for regular changes
            sp_playlist_remove_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::playlistCallbacks, this);
            qDebug() << "ADDING SYNC CALLBACKS FOR PLAYLIST:" << sp_playlist_name( m_playlists[ index ].playlist_ );
            if ( m_playlists[ index ].sync_ )
            {
                qDebug() << "ASKING TO SYNC A ALREADY SYNCED PLAYLIST";
                sp_playlist_remove_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
            }
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
  Callback from libspotify
  **/

void SpotifyPlaylists::tracksRemoved(sp_playlist *playlist, const int *tracks, int num_tracks, void *userdata)
{
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    QList<int> removedTrackIndices;
    for (int i = 0; i < num_tracks; i++)
        removedTrackIndices << tracks[i];

    qDebug() << "Tracks removed callback for playlist:" << sp_playlist_name( playlist ) << "and indices removed:" << removedTrackIndices << ", now calling member func";
    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _playlists, "removeTracksFromSpotify", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(QList<int>, removedTrackIndices));
    else
        _playlists->removeTracksFromSpotify( playlist, removedTrackIndices );
}

/**
  tracksMoved
  Callback from libspotify
  **/

void
SpotifyPlaylists::tracksMoved(sp_playlist *playlist, const int *tracks, int num_tracks, int new_position, void *userdata)
{

    qDebug() << "Tracks moved";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );

    QList<int> movedTrackIndices;
    for (int i = 0; i < num_tracks; i++)
        movedTrackIndices << tracks[i];

    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _playlists, "moveTracks", Qt::QueuedConnection, Q_ARG(sp_playlist*, playlist), Q_ARG(QList<int>, movedTrackIndices), Q_ARG(int, new_position) );
    else
        _playlists->moveTracks( playlist, movedTrackIndices, new_position );

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
  removePlaylistNotification
  got a notification to delete a spotify playlist
  **/
void
SpotifyPlaylists::removePlaylistNotification( sp_playlist* playlist )
{
    if ( m_waitingToLoad.contains( playlist ) )
    {
        // short circuit---if we're waiting for it to load, just abort the wait
        m_waitingToLoad.removeAll( playlist );
        return;
    }

    LoadedPlaylist pl;
    pl.playlist_ = playlist;

    int index = m_playlists.indexOf( pl );

    qDebug() << Q_FUNC_INFO << "Got playlist deleted:" << playlist;
    if( index != -1)
    {
        const QString plid = m_playlists[ index ].id_;
        Sync s;
        s.id_ = m_playlists[ index ].id_;

        if ( m_syncPlaylists.contains( s ) )
        {
 //           qDebug() << Q_FUNC_INFO << "And deleted playlist is synced, so sending to clients:" << plid;
            m_syncPlaylists.removeAll( s );
        }

        if ( !sApp->ignoreNextUpdate() )
            emit sendPlaylistDeleted( plid );

        m_playlists.removeAt( index );

    }

    writeSettings();
    emit notifyContainerLoadedSignal();
}

/**
  doRemovePlaylist
  Slot to remove a playlist from the container, PERMANENT

  **/
void
SpotifyPlaylists::doRemovePlaylist( sp_playlist *playlist )
{
    LoadedPlaylist pl;
    pl.playlist_ = playlist;

    int index = m_playlists.indexOf( pl );
    int pcIndex = index;

    if ( sp_playlistcontainer_playlist( SpotifySession::getInstance()->PlaylistContainer(), index ) != playlist )
    {
        qWarning() << "Was asked to delete a playlist that we have in a different index from the playlist container! Trying to find the real one";
        for( int i = 0; i < sp_playlistcontainer_num_playlists( SpotifySession::getInstance()->PlaylistContainer() ); i++ )
        {
            if ( sp_playlistcontainer_playlist( SpotifySession::getInstance()->PlaylistContainer(), i ) == playlist )
            {
                pcIndex = i;
                break;
            }
        }
    }

    if ( pcIndex > -1 )
    {
        sApp->setIgnoreNextUpdate( true );
        sp_playlistcontainer_remove_playlist( SpotifySession::getInstance()->PlaylistContainer(), pcIndex );
    } else
        qWarning() << "Failed to find playlist to delete in the playlistcontainer....";
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
    if ( QThread::currentThread() != QCoreApplication::instance()->thread() )
        QMetaObject::invokeMethod( _playlists, "setPlaylistInProgress", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(bool, done) );
    else
        _playlists->setPlaylistInProgress( pl, done );

}

/**
  addNewPlaylist
  this will create a new playlist from QVariantMap
  The map must contain
    Title
    Sync
    QVariantList of tracks
        With string keys
            track
            artist
            album
    qid
  **/
void
SpotifyPlaylists::addNewPlaylist( const QVariantMap& data )
{
    const QString title = data.value( "title" ).toString();
    const bool sync = data.value( "sync" ).toBool();
    const QString qid = data.value( "qid" ).toString();

    qDebug() << "Creating playlist with name " << title;

    if ( title.trimmed().isEmpty() )
    {
        qDebug() << "Got empty or whitespace title... not allowed as a playlist name! ignoring.";
        return;
    }

    m_playlistNameCreationToIgnore.insert( title );
    sp_playlist* playlist = sp_playlistcontainer_add_new_playlist( SpotifySession::getInstance()->PlaylistContainer(), title.toUtf8() );

    qDebug() << "Created playlist! Adding tracks to it if needed...";
    const QVariantList tracks = data.value( "tracks" ).toList();

    doAddNewPlaylist( playlist, tracks, sync, qid );
}

/**
  doAddNewPlaylist
  slot to add new playlist
  **/
void
SpotifyPlaylists::doAddNewPlaylist( sp_playlist* playlist, const QVariantList& tracks, bool sync, const QString& qid )
{

    if ( !sp_playlist_is_loaded( playlist ) )
    {
        qDebug() << "Waiting for playlist to be loaded that we just create...";
        addStateChangedCallback( NewPlaylistClosure( boost::bind(checkPlaylistIsLoaded, playlist), this, SLOT( doAddNewPlaylist(sp_playlist*, const QVariantList&, const QString& ) ), playlist, tracks, qid) );

        return;
    }

    addPlaylist( playlist, sync );
    LoadedPlaylist pl = m_playlists.last();
    if ( pl.playlist_ != playlist )
    {
        qWarning() << "Failed to add playlist to internal representation! Aborting...";
        return;
    }

    sApp->registerQidForPlaylist( qid, pl.id_ );
    if ( tracks.isEmpty() )
    {
        // No work to do :)
        sApp->sendAddTracksResult( pl.id_, QList<int>(), QList< QString >(), true );
    }
    else
    {
        doAddTracksToSpotifyPlaylist( tracks, playlist, pl.id_, 0 );
    }

    // resend list of playlists
    emit notifyContainerLoadedSignal();
}

/**
  moveTracksInSpotifyPlaylist
  called from client when move
  **/
sp_error
SpotifyPlaylists::moveTracksInSpotifyPlaylist( const QString& playlistId, const QVariantList& tracks, const QString& newStartPositionId )
{
//    qDebug() << "MOVING tracks in playlist with id " << playlistId;
//    qDebug() << "Tracks to move:" << tracks;

    LoadedPlaylist loader;
    loader.id_ = playlistId;
    const int index = m_playlists.indexOf( loader );

    if ( index == -1 )
    {
        qWarning() << "Asked to move tracks in a spotify playlist that doesn't exist!" << playlistId;
        return SP_ERROR_INVALID_INDATA;
    }

    sp_playlist* pl = m_playlists[index].playlist_;

    if ( !pl || !sp_playlist_is_loaded( pl ) )
    {
        qWarning() << "Asked to move tracks in a spotify playlist that is null or is not loaded!" << pl << ( (pl != 0 ) ? (sp_playlist_is_loaded( pl ) ? "Loaded" : "Unloaded") : QString()) ;
        return SP_ERROR_INVALID_INDATA;
    }

    QList< QString> trackIdsToMove;
    foreach( const QVariant& track, tracks )
    {
        const QVariantMap trackMap = track.toMap();
        if ( trackMap.contains( "id" ) )
            trackIdsToMove << trackMap[ "id" ].toString();
    }

    QVector<int> moveIndexes;
    int newStartPosition = -1;
    for( int i = 0; i < m_playlists[ index ].tracks_.size(); i++ )
    {
        const QString trackid = trackId( m_playlists[ index ].tracks_[ i ] );
        if ( trackIdsToMove.contains( trackid ) )
            moveIndexes.append( i );
        else if ( trackid == newStartPositionId )
            newStartPosition = i;
    }
    newStartPosition++; // New target position, not position before;
    newStartPosition = qBound( 0, newStartPosition, m_playlists[index].tracks_.size() ); // safety

    sApp->setIgnoreNextUpdate( true );
    sp_error ret = sp_playlist_reorder_tracks( m_playlists[ index ].playlist_, moveIndexes.constBegin(), moveIndexes.size(), newStartPosition );
    return ret;
}

/**
  renamePlaylist
  will rename a playlist that contains
    data[playlistid] = spotifyUri
    data[newtitle] = QString
  **/

void
SpotifyPlaylists::renamePlaylist( const QVariantMap& data )
{
    LoadedPlaylist playlist = getPlaylist( data.value( "playlistid" ).toString() );
    if( !playlist.id_.isEmpty() && playlist.isLoaded )
    {
        const QString newTitle = data.value( "newTitle").toString();
        qDebug() << "Renameing playlist with name " << playlist.name_ << " to " << newTitle;
        sp_playlist_rename( playlist.playlist_, newTitle.toUtf8() );

    }

}

void
SpotifyPlaylists::addSearchedTrack( sp_search* result, void* userdata )
{
    SpotifySearch::addSearchedTrack( result, userdata );
}


/**
  addTracksToSpotify

  **/
void
SpotifyPlaylists::addTracksToSpotifyPlaylist( const QVariantMap& data )
{
    qDebug() << "Adding tracks to playlist with id " << data.value( "playlistid");

    const QString playlistId = data.value( "playlistid").toString();
    LoadedPlaylist loader;
    loader.id_ = playlistId;
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
    const QString trackId = data.value( "startPosition" ).toString();

    int position = findTrackPosition( m_playlists[ index ].tracks_, trackId );
    position++; // Spotify wants the position to be the newly inserted pos, not the 0-based index of the track *to* insert
    if ( position == 0 )
    {
        // We didn't find the position in the playlist, or there was none, so append
        position = m_playlists[ index ].tracks_.size();
    }

    doAddTracksToSpotifyPlaylist( tracks, pl, playlistId, position );
}

/**
  doAddTracksToSpotify
  slot that take a list of tracks, and performs a search
  to retrevie sp_tracks*'s

  **/
void
SpotifyPlaylists::doAddTracksToSpotifyPlaylist( const QVariantList& tracks, sp_playlist* pl, const QString& playlistId, int startPosition )
{

//   qDebug() << "Adding tracks to playlist " << sp_playlist_name( pl );
    qDebug() << "Adding tracks to spotify playlist at position:" << startPosition;

    AddTracksData* addData = new AddTracksData;
    addData->plid = playlistId;
    addData->playlist = pl;
    addData->pos = startPosition;
    addData->waitingFor = 0;

    addData->finaltracks.resize( tracks.size() );
    addData->searchOrder.resize( tracks.size() );

    for ( int i = 0; i < tracks.size(); i++ )
    {
        const QVariant& track = tracks[ i ];

        const QString artist = track.toMap().value( "artist" ).toString();
        const QString title = track.toMap().value( "track" ).toString();
        const QString album = track.toMap().value( "album" ).toString();

        QString query = QString(artist + " " + title + " " + album);
#if SPOTIFY_API_VERSION >= 11
        sp_search* s = sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, 0, 0, SP_SEARCH_STANDARD, &SpotifySearch::addSearchedTrack, addData );
#else
        sp_search* s = sp_search_create( SpotifySession::getInstance()->Session(), query.toUtf8().data(), 0, 1, 0, 0, 0, 0, &SpotifySearch::addSearchedTrack, addData );
#endif
        qDebug() << "Got sp_search object for track:" << s << query;
        addData->waitingFor++;

        // to help us choose the right order since we can get the results in any order
        addData->searchOrder[ i ] = s;
    }
}

/**
  findTracksPosition
  Finds the position of trackId in list
  **/
int
SpotifyPlaylists::findTrackPosition( const QList< sp_track* > tracks, const QString& trackId )
{
    int position = -1;

    if ( !trackId.isEmpty() )
    {
        sp_link* link = sp_link_create_from_string( trackId.toUtf8().constData() );
        if ( sp_link_type( link ) == SP_LINKTYPE_TRACK )
        {
            sp_track* targetTrack = sp_link_as_track( link );
            for ( int i = 0; i < tracks.size(); i++ )
            {
                const sp_track* track = tracks[ i ];
                if ( track == targetTrack )
                {
//                    qDebug() << "Found track in playlist with associated id to use as insertion point:" << trackId << sp_track_name( targetTrack ) << sp_track_artist( targetTrack, 0 ) << "at:" << i << "out of:" << tracks.size() << "tracks";
                    position = i;
                    break;
                }
            }
        }
        sp_link_release( link );
    }

    return position;
}


/**
  Remove tracks from spotify playlist with data
  **/

bool
SpotifyPlaylists::removeFromSpotifyPlaylist( const QVariantMap& data ){

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

                if( id == QString::fromUtf8(trackId) )
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

 //   qDebug() << "Was asked to remove" << tracks.size() << "tracks, found" << positions.size() << "matching";
    if ( !positions.isEmpty() )
    {
//        qDebug() << "Removing found:" << positions.size() << "tracks from playlist!";

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
    }

    if( timestamp == 0 )
    {
//        qDebug() << "Revision playlist was cleared from contents!";
        updateRevision( pl, QDateTime::currentMSecsSinceEpoch() / 1000);
    }
    else if( timestamp > pl.newTimestamp )
    {
        // Hash later with appropriate hash algorithm.
        updateRevision( pl, timestamp );
    }
}

/**
  updateRevision with qualifier
  Will update the revision with a hashed qualifier
**/
void
SpotifyPlaylists::updateRevision( LoadedPlaylist &pl, int qualifier, QStringList removedTracks )
{
    int plIndex = m_playlists.indexOf( pl );
    if( plIndex == -1 )
    {
        qDebug() << "Trying to update revision for playlist we dont know about, WTF!";
        return;
    }

    /// @note: New revision wont handle removed tracks. Only new tracks.
    /// So, if the tracks isnt in oldRev, its appended to newRev.
    /// LoadedPlaylist.tracks_ will contain all current tracks.
    if( qualifier > pl.newTimestamp )
    {

        RevisionChanges oldRevision;
        RevisionChanges newRevision;

        if( !pl.revisions.isEmpty() )
        {

            oldRevision = pl.revisions.last();
//            qDebug() << "Setting new revision " << qualifier <<  "Old rev: " << oldRevision.revId;
            QString trackid;
            foreach( sp_track *newRevTrack, pl.tracks_ )
            {
               trackid = trackId( newRevTrack );

               if( !oldRevision.revTrackIDs.contains( trackid ) )
               {
                   newRevision.revTrackIDs.append( trackid );
               }

            }
            if( !removedTracks.isEmpty() )
            {
                foreach( QString trackId, removedTracks )
                {
                    if( !oldRevision.revRemovedTrackIDs.contains( trackId ) )
                        newRevision.revRemovedTrackIDs.append( trackId );
                }
            }

        }else
        {
//            qDebug() << "============ No old rev! Appending all";
            foreach( sp_track *newRevTrack, pl.tracks_ )
               newRevision.revTrackIDs.append( trackId( newRevTrack ) );
        }

        /// @TODO/note: we try and keep all the revision, these should be cached

        pl.oldTimestamp = pl.newTimestamp;
        pl.newTimestamp = qualifier;
        // MD5 hash for revisionId
        newRevision.revId = QString(QCryptographicHash::hash( QString( pl.name_ + QString::number( qualifier ) ).toUtf8(),QCryptographicHash::Md5).toHex() );
        pl.revisions.append( newRevision );
        m_playlists[ plIndex ] = pl;

//        qDebug() << "===== DONE Setting new revision " << pl.revisions.last().revId <<  "Old rev: " << oldRevision.revId << "revCount" << pl.revisions.last().revTrackIDs.count() << "removedCount: " << pl.revisions.last().revRemovedTrackIDs.count();
    }

}

/**
  Closure callback
  Adds a waitFor playlist to LoadedPlaylists
  **/

void
SpotifyPlaylists::playlistLoadedSlot(sp_playlist* pl)
{
    qDebug() << Q_FUNC_INFO << "Got playlist loaded that we were waiting for, now we have:" << m_waitingToLoad << "left";
    addPlaylist(pl);
    checkForPlaylistsLoaded();
}

/**
  checkForPlaylistLoaded
  **/
void
SpotifyPlaylists::checkForPlaylistsLoaded()
{
    if(m_waitingToLoad.isEmpty())
    {
        qDebug() << "========== GOT ALL PLAYLISTS LOADED, EMITTING SIGNAL!";
        m_isLoading = false;
        m_allLoaded = true;
        m_loadTimer->stop();
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
SpotifyPlaylists::addPlaylist( sp_playlist *pl, bool forceSync, bool isSubscribed )
{

//     qDebug() << "addPlaylist from thread id" << thread()->currentThreadId();
    if( !pl )
    {
//        qDebug() << Q_FUNC_INFO << "Pl was null";
        return;
    }

    if( !sp_playlist_is_loaded( pl ) )
    {
//        qDebug() << Q_FUNC_INFO << "Pl isnt loaded";
        return;
    }

//    qDebug() << "Playlist has " << sp_playlist_num_tracks( pl ) << " number of tracks";

    m_waitingToLoad.removeAll( pl );

    LoadedPlaylist playlist;

    // Get the spotify id for the playlist
    char linkStr[256];
    sp_link *pl_link = sp_link_create_from_playlist( pl );
    if( pl_link )
    {
        sp_link_as_string( pl_link, linkStr, sizeof( linkStr )) ;
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

        qDebug() << "Failed to get URI for playlist when trying to add! Aborting...";
        return;
    }

    // Ensure we dont get multiple callbacks registered, gets readded further down
    sp_playlist_remove_callbacks( pl, &SpotifyCallbacks::playlistCallbacks, this );
    sp_playlist_remove_callbacks( pl, &SpotifyCallbacks::syncPlaylistCallbacks, this );

    // if it's already loaded, ignore it!
    if ( m_playlists.indexOf( playlist ) >= 0 && m_playlists[ m_playlists.indexOf( playlist ) ].isLoaded )
        return;

    playlist.playlist_ = pl;
    playlist.name_ = QString::fromUtf8( sp_playlist_name( pl ) );
    playlist.owner_ = sp_user_canonical_name( sp_playlist_owner( pl ) );
    playlist.isCollaborative = sp_playlist_is_collaborative( pl );

    QString username = sp_user_canonical_name( sp_session_user( SpotifySession::getInstance()->Session() ) );
    if( username != playlist.owner_ )
        isSubscribed = true;

    playlist.isSubscribed = isSubscribed;
    playlist.starContainer_ = false;
    playlist.sync_ = false;
    playlist.isLoaded = false;

    int tmpRev = 0;
    sp_playlist_add_ref( pl );

    // Precaution, to prevent mixing up the starred tracks container and user playlistnameings.
#if SPOTIFY_API_VERSION >= 11
    if( playlist.id_.contains( username + ":starred" ) )
#else
    if( playlist.id_.contains( "spotify:user:" + username + ":playlist:0000000000000000000000" ) )
#endif
    {
//        qDebug() << "Marking starred track playlist" << pl;
        playlist.name_ =  "Starred Tracks";
        playlist.starContainer_ = true;
    }

//    qDebug() << "Adding " << sp_playlist_num_tracks( playlist.playlist_ ) << "tracks to our LoadedPlaylist object for" << playlist.name_;
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
    if( m_syncPlaylists.contains( syncThis ) || forceSync )
    {
        qDebug() << "Adding syncing for playlist " << playlist.id_;
        playlist.sync_ = true;
        setSyncPlaylist( playlist.id_, true );
    }

    // We need to add the callbacks for normal playlist, to keep listening on changes.
    sp_playlist_add_callbacks( playlist.playlist_, &SpotifyCallbacks::playlistCallbacks, this);
    sp_playlist_update_subscribers( SpotifySession::getInstance()->Session(), pl );
    // emit starred playlist is loaded
    if( playlist.starContainer_ )
        emit notifyStarredTracksLoadedSignal();

    /// Finaly, update revisions
    // Revision, initially -1
    playlist.oldTimestamp = -1;
    playlist.newTimestamp = -1;

    updateRevision( playlist, tmpRev );

}

/**
  ensurePlaylistLoadedTimerFired
  **/
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
//            qDebug() << "Delayed find of playlist that is actually loaded... adding";
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
  printPlaylistTracks
  function to use with gdb
  **/

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

/**
  checkTracksAreLoaded
  used with boost to add closures
  **/
bool checkTracksAreLoaded(QList< sp_track* > waitingForLoaded)
{
    bool found = !waitingForLoaded.isEmpty();
    foreach ( sp_track* t, waitingForLoaded )
    {
        if ( t && sp_track_is_loaded( t ) )
            qDebug() << "Found now-loaded track we were waiting for:" << sp_track_name(t) << sp_artist_name(sp_track_artist(t,0));
        else
            found = false;
    }
    return found;
}

/**
  checkPlaylistIsLoaded
  used with boost in closure
  **/
bool checkPlaylistIsLoaded(sp_playlist* pl )
{
    return pl && sp_playlist_is_loaded( pl );
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
