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

#include "spotifyplaylists.h"
#include "callbacks.h"
#include <QObject>
#include <QThread>
#include <QDateTime>
SpotifyPlaylists::SpotifyPlaylists( QObject *parent )
   : QObject( parent )
{

    /**
        Read the QSettings to set the sync states from previous settings
    **/
    qDebug() << "Starting playlists in thread id" << thread()->currentThreadId();
    QSettings settings;
    int size = settings.beginReadArray( "syncPlaylists" );

    for ( int i = 0; i < size; ++i )
    {
         settings.setArrayIndex( i );
         Sync sync;
         sync.id_ = settings.value( "id" ).toString();
         qDebug() << sync.id_;
         sync.sync_ = settings.value( "sync" ).toBool();
         m_syncPlaylists.append( sync );
         setSyncPlaylist( sync.id_ );
    }

    settings.endArray();
    qRegisterMetaType< sp_playlist* >("sp_playlist*");
    qRegisterMetaType< int* >("int*");
    qRegisterMetaType< sp_playlistcontainer* >("sp_playlist_continer*");
    qRegisterMetaType< SpotifyPlaylists::LoadedPlaylist >("SpotifyPlaylists::LoadedPlaylist");
}


/**
  Destructor
    This destructor is important.
    It removes callbacks and frees playlists and its tracks
**/

SpotifyPlaylists::~SpotifyPlaylists()
{

    qDebug() << "Destroying playlists";
    for ( int i = 0 ; i < sp_playlistcontainer_num_playlists( SpotifySession::getInstance()->PlaylistContainer() ) ; ++i )
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

}

/**
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/
void
SpotifyPlaylists::stateChanged( sp_playlist* pl, void* userdata )
{

    qDebug() << Q_FUNC_INFO;

    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    qDebug() << "Callback on thread" << _playlists->thread()->currentThreadId();

    // If the playlist isn't loaded yet we have to wait
    if ( !sp_playlist_is_loaded( pl ) )
    {
      qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }else
    {
        qDebug() << "Invoking addPlaylist from thread id" << _playlists->thread()->currentThreadId();
        if( QThread::currentThread() !=_playlists->thread() )
                QMetaObject::invokeMethod( _playlists, "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl) );
        //_playlists->addPlaylist( pl );
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
    qDebug() << "Sync state changed";
    if ( !sp_playlist_is_loaded( pl ) )
    {
      qDebug() << "Playlist isn't loaded yet, waiting";
      return;
    }
    //SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    //_playlists->doSend( _playlists->getLoadedPlaylist( pl ) ); //_playlists->doSend();
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
  Callback
    State changed
    Called from libspotify when state changed on playlist
**/

void
SpotifyPlaylists::playlistContainerLoadedCallback( sp_playlistcontainer* pc, void* userdata)
{

    SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );

    qDebug() << "Invoking container load from thread id" << _session->Playlists()->thread()->currentThreadId();
    if( QThread::currentThread() != _session->Playlists()->thread() )
        QMetaObject::invokeMethod( _session->Playlists(), "loadContainerSlot", Qt::QueuedConnection, Q_ARG(sp_playlistcontainer*, pc) );

}

void
SpotifyPlaylists::loadContainerSlot(sp_playlistcontainer *pc){

    qDebug() << "Container load from thread id" << thread()->currentThreadId();
    for ( int i = 0 ; i < sp_playlistcontainer_num_playlists( pc ) ; ++i )
    {
        sp_playlist* playlist = sp_playlistcontainer_playlist( pc, i );
        sp_playlist_add_callbacks( playlist, &SpotifyCallbacks::playlistCallbacks, this );
    }
    /**
      This creates the starred tracks playlist, and will automatically add it to the synclist
    **/
    sp_playlist* starredTracks = sp_session_starred_create( SpotifySession::getInstance()->Session() );
    sp_playlist_add_callbacks( starredTracks, &SpotifyCallbacks::syncPlaylistCallbacks, this );

    QString name = sp_user_canonical_name( sp_session_user( SpotifySession::getInstance()->Session() ) );
    QString starredId = "spotify:user:" + name + ":playlist:0000000000000000000000";

    qDebug() << "Invoking addPlaylist from thread id" << thread()->currentThreadId();
    if( QThread::currentThread() != thread() )
        QMetaObject::invokeMethod( this, "addPlaylist", Qt::QueuedConnection, Q_ARG(sp_playlist*, starredTracks) );

    //addPlaylist( starredTracks );
    setSyncPlaylist( starredId );
    SpotifySession::getInstance()->setPlaylistContainer( pc );

    qDebug() << Q_FUNC_INFO << "done";
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
   qDebug() << "Playlist added";
   SpotifySession* _session = reinterpret_cast<SpotifySession*>( userdata );
   qDebug() << "Callback on thread" << _session->Playlists()->thread()->currentThreadId();
   _session->Playlists()->addPlaylist( playlist );

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
     _session->Playlists()->setPosition( playlist, position, new_position );
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
    _session->Playlists()->removePlaylist( playlist );
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
    _playlists->addTracks( pl, tracks, num_tracks, position);
}



/**
   addTracks(sp_playlist*, sp_tracks * const *tracks, int num_tracks)
**/
void
SpotifyPlaylists::addTracks(sp_playlist* pl, sp_track *const*tracks, int num_tracks, int pos)
{
    qDebug() << "Adding tracks to" << sp_playlist_name(pl);

    LoadedPlaylist playlist;
    playlist.playlist_ = pl;
    const int index = m_playlists.indexOf( playlist );
    if( index != -1 ){

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
        updateRevision( &m_playlists[index] );

    }

}

/**
  updateRevision
  Will update the revision with a timestamp
**/

void
SpotifyPlaylists::updateRevision( LoadedPlaylist *pl )
{
    qDebug() << Q_FUNC_INFO << "count" << pl->tracks_.count();
    int timestamp(0);
    for( int i = 0; i < pl->tracks_.count(); i++)
    {
        int tmpTimestamp = sp_playlist_track_create_time( pl->playlist_, i );

        if( timestamp < tmpTimestamp )
            timestamp = tmpTimestamp;

        qDebug() << "Revision timestamp" << tmpTimestamp << "current highest timestamp" << timestamp;
    }

    /**
      @note: Todo, confirm this. Though it seems its correct.
      timestamp is 0, that means the playlist is cleared of contents, or was empty to begin with
      @note This applies if no timestamp was set from within this application, not the API
    **/
    if( timestamp == 0 )
    {
        qDebug() << "Revision playlist was cleared from contents!";
        pl->newRev = 0;
    }
    else if( timestamp > pl->newRev )
    {
        qDebug() << "Setting new revision " << timestamp <<  "Old rev: " << pl->oldRev;
        // Hash later with appropriate hash algorithm.
        pl->oldRev = pl->newRev;
        pl->newRev = timestamp;

    }
    //if( pl->sync_ )
    //    doSend( *(pl) );

}

/**
  updateRevision with qualifier
  Will update the revision with a hashed qualifier
**/
void
SpotifyPlaylists::updateRevision( LoadedPlaylist *pl, int qualifier )
{
    qDebug() << Q_FUNC_INFO << "Qualifier " << qualifier << "rev " << pl->oldRev;
    if( qualifier > pl->newRev)
    {
        qDebug() << "Setting new revision " << qualifier <<  "Old rev: " << pl->oldRev;
        // Hash later with appropriate hash algorithm.
        pl->oldRev = pl->newRev;
        pl->newRev = qualifier;

    }
    //if( pl->sync_ )
    //    doSend( *(pl) );
}


/**
  removeTracks(sp_playlist*, const int*tracks, int num_tracks)
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
        qDebug() << "Updateing revision with removetrack timestamp " << timestamp;
        updateRevision( &m_playlists[index], timestamp );
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
        updateRevision( &m_playlists[index], timestamp );
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
 setSyncPlaylist( const QString )
   sets syncflags on a playlist
   Saves state to QSettings
**/
void
SpotifyPlaylists::setSyncPlaylist( const QString id )
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
        syncThis.sync_ = true;
        if( !m_syncPlaylists.contains( syncThis ) )
        {
             m_syncPlaylists.append( syncThis );
             QSettings settings;
             settings.beginWriteArray("syncPlaylists");
             for ( int i = 0; i < m_syncPlaylists.size(); ++i )
             {
                 settings.setArrayIndex( i );
                 settings.setValue( "id" , m_syncPlaylists.at( i ).id_ );
                 settings.setValue( "sync" , m_syncPlaylists.at( i ).sync_ );
             }
             settings.endArray();
         }
        m_playlists[ index ].sync_ = true;
        sp_playlist_add_callbacks( m_playlists[ index ].playlist_, &SpotifyCallbacks::syncPlaylistCallbacks, this);
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
    if( QThread::currentThread() != _playlists->thread() )
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

    qDebug() << "Invoking move from thread id" << _playlists->thread()->currentThreadId();
    if( QThread::currentThread() != _playlists->thread() )
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
    qDebug() << "In Progress" << sp_playlist_name(pl);
    qDebug() << "In Progress in thread id" << thread()->currentThreadId();
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    const int index = m_playlists.indexOf( playlist );

    if( index != -1 ){
        qDebug() << "Playlist progress is" << (done ? "done" : "still loading..." ) << index;
        m_playlists[ index ].isLoaded = done;
        if( done && m_playlists[index].sync_)
            doSend( m_playlists[ index ] );
    }


}

/**
  playlistUpdateInProgress
  Callback, fired whenever a change is processed
  **/
void
SpotifyPlaylists::playlistUpdateInProgress(sp_playlist *pl, bool done, void *userdata)
{
    qDebug() << "Update in progress";
    SpotifyPlaylists* _playlists = reinterpret_cast<SpotifyPlaylists*>( userdata );
    qDebug() << "Invoking setPlaylistInProgress from thread id" << _playlists->thread()->currentThreadId();
    if( QThread::currentThread() != _playlists->thread() )
        QMetaObject::invokeMethod( _playlists, "setPlaylistInProgress", Qt::QueuedConnection, Q_ARG(sp_playlist*, pl), Q_ARG(bool, done) );

    //_playlists->setPlaylistInProgress( pl, done );

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
    qDebug() << "addPlaylist from thread id" << thread()->currentThreadId();
    if( !sp_playlist_is_loaded( pl ) )
        return;
    LoadedPlaylist playlist;
    playlist.playlist_ = pl;

    int index = m_playlists.indexOf( playlist );
    if( index != -1 )
        return;

    qDebug() << "Adding" << sp_playlist_name(pl);

    playlist.starContainer_ = false;
    playlist.sync_ = false;
    playlist.isLoaded = false;

    // Revision, initially -1
    playlist.oldRev = -1;
    playlist.newRev = -1;
    int tmpRev(0);

    // Get the spotify id for the playlist
    char linkStr[256];
    sp_link *pl_link = sp_link_create_from_playlist( pl );
    sp_link_as_string( pl_link, linkStr, sizeof(linkStr));
    sp_link_release( pl_link );
    playlist.id_ = linkStr;

    playlist.name_ = sp_playlist_name(pl);

    /**
      Starred playlist folder will get a 0 hash as linkstr
      Use that to set the id
    **/
    if( playlist.id_.contains( "0000000000000000000000" ) )
    {
        playlist.name_ =  "Starred Tracks";
        playlist.starContainer_ = true;
    }

    for ( int i=0 ; i< sp_playlist_num_tracks( pl ); ++i )
    {
        sp_track* track = sp_playlist_track( pl, i );
        sp_track_add_ref( track );

        // Set revision on initation
        int timestamp = sp_playlist_track_create_time( pl, i);
        if( tmpRev < timestamp)
            tmpRev = timestamp;

        playlist.tracks_.push_back( track );
    }

    qDebug() << "Updateing revision with " << tmpRev;
    updateRevision( &playlist, tmpRev );

    // Playlist is loaded and ready
    playlist.isLoaded = true;

    // If the list contains the playlist, update it
    // else, append it

    if(!m_playlists.contains( playlist ) )
    {
        m_playlists.append( playlist );

        /**
          Initially, when reading QSettings for syncPlaylists
          we cant set the callbacks directly, as they are not loaded yet.
          This will add sync callbacks for the loaded playlists,
        **/
        Sync syncThis;
        syncThis.id_ = playlist.id_;
        if( m_syncPlaylists.contains( syncThis ) )
        {
            qDebug() << "Adding syncing for  playlist " << playlist.id_;
            setSyncPlaylist( playlist.id_ );
        }

        // Want to test sync? Add all playlists to syncing
        //setSyncPlaylist( playlist.id_ );
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
