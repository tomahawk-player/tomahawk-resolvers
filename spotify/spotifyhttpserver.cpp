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


#include "spotifyhttpserver.h"
#include "spotifysession.h"
#include "spotifyplaylists.h"
#include "spotifyplayback.h"
#include "spotifyiodevice.h"
#include <QThread>
#include <QTimer>
SpotifyHTTPServer::SpotifyHTTPServer( QxtAbstractWebSessionManager* sm, int port, QObject* parent )
    : QxtWebSlotService( sm, parent )
    , m_port( port )

{
    qDebug() << "Starting a new SpotifyHttpServer!";

}

void SpotifyHTTPServer::index( QxtWebRequestEvent* event )
{
    QVariantMap json_object, methods;

    methods.insert( "playlists", "List all playlists" );
    methods.insert( "playlist/id", "Get playlist id and its content" );
    methods.insert( "sync/id", "Register sync for id" );
    methods.insert( "starred", "List all starred tracks" );
    methods.insert( "play", "Spotify uri" );
    json_object.insert( "methods", methods );

    QByteArray response;
    ////response.append(QxtJSON::stringify( json_object ) );

    QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, response );
    wpe->status = 202;
    wpe->statusMessage = "OK";
    wpe->contentType = JSON;
    postEvent( wpe );
    return;
}



void SpotifyHTTPServer::play( QxtWebRequestEvent* event, QString id )
{

    qDebug() << QThread::currentThreadId() << "HTTP" << event->url.toString() << id;

    if( !SpotifySession::getInstance()->Playback()->trackIsOver() ) {
        SpotifySession::getInstance()->Playback()->endTrack();
    }

    sp_link *track_link = sp_link_create_from_string( id.toUtf8() );
    sp_track *track = sp_link_as_track( track_link );

    if( !track )
    {
        qWarning() << QThread::currentThreadId() << "Uh oh... got null track from link :(" << sp_link_type( track_link );
    }

    if( !sp_track_is_loaded( track ) ) {
        qWarning() << QThread::currentThreadId() << "uh oh... track not loaded yet! Asked for:" << sp_track_name( track );
        m_savedEvent = event;
        m_savedTrack = track;
        QTimer::singleShot( 250, this, SLOT( checkForLoaded() ) );

    } else {
        startStreamingResponse( event, track );
    }
}

void SpotifyHTTPServer::checkForLoaded()
{
     qDebug() << "Checking...";
    if( !sp_track_is_loaded( m_savedTrack ) ) {
         qWarning() << QThread::currentThreadId() << "uh oh... track not loaded yet! Asked for:" << sp_track_name( m_savedTrack );
        QTimer::singleShot( 250, this, SLOT( checkForLoaded() ) );
    } else {
        startStreamingResponse( m_savedEvent, m_savedTrack );
    }

}

void SpotifyHTTPServer::startStreamingResponse( QxtWebRequestEvent* event, sp_track* track )
{
    // yay we gots a track
    qDebug() << QThread::currentThreadId() << "We got a track!" << sp_track_name( track ) << sp_artist_name( sp_track_artist( track, 0 ) ) << sp_track_duration( track );
    uint duration = sp_track_duration( track );

    sp_error err = sp_session_player_load( SpotifySession::getInstance()->Session(), track );
    if( err != SP_ERROR_OK ) {
        qWarning() << QThread::currentThreadId() << "Failed to start track from spotify :(" << sp_error_message( err );
        //sendErrorResponse( event );
        return;
    }

    qDebug() << QThread::currentThreadId() << "Starting to play!";
    sp_session_player_play( SpotifySession::getInstance()->Session(), true );
    SpotifySession::getInstance()->Playback()->startPlaying();
    qDebug() << "Getting iodevice...";
    spotifyiodev_ptr iodev = SpotifySession::getInstance()->Playback()->getIODeviceForNewTrack( duration );
    qDebug()  << QThread::currentThreadId() << "Got iodevice to send:" << iodev << iodev.isNull() << iodev->isSequential() << iodev->isReadable();

    /**
      @warning: iodev is passed as data() to Qxt, but in qxtstandalone (tomahawk) it should be taken as just iodev
      **/
    QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, iodev );
    wpe->streaming = true;
    wpe->contentType = "audio/basic";
    postEvent( wpe );
}

void SpotifyHTTPServer::playlist( QxtWebRequestEvent* event, QString id )
{
    QByteArray response;
    QVariantList data;
    SpotifyPlaylists::LoadedPlaylist pl = SpotifySession::getInstance()->Playlists()->getPlaylist( id );
    qDebug() << pl.tracks_.count();

    if( pl.isLoaded )
    {

        QVariantMap playlist;
        QVariantMap track;
        QVariantList trackList;

        foreach( sp_track *t, pl.tracks_ )
        {
            track.insert("track", QString(sp_track_name( t ) ).replace( "\"", "\\\"" ) );
            track.insert("artist", QString( sp_artist_name( sp_track_artist( t,0 ) ) ).replace( "\"", "\\\"" ) );
            track.insert("album", QString( sp_album_name( sp_track_album( t ) ) ).replace( "\"", "\\\"" ) );
            trackList << track;
        }
        if( pl.starContainer_ )
            playlist.insert( "Starred Tracks", trackList );
        else
            playlist.insert( QString( sp_playlist_name( pl.playlist_ ) ).replace( "\"", "\'" ), trackList );
        data << playlist;

    }
    else
    {

        data << "Fail to load playlist";

    }


    //response.append( QxtJSON::stringify( data ) );


    if( response.isEmpty( ) )
        if( !SpotifySession::getInstance()->isPlaylistContainerLoaded() )
             qDebug() << "Still loading playlists..."; //response.append( QxtJSON::stringify( "Still loading playlists...." ) );
        else
             qDebug() << "No pls.."; //response.append( QxtJSON::stringify( "No playlists...." ) );

        QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, response );
        wpe->status = 202;
        wpe->statusMessage = "OK";
        wpe->contentType = JSON;
        postEvent( wpe );



    return;
}

void SpotifyHTTPServer::playlists( QxtWebRequestEvent* event )
{
    QByteArray response;
    {
        qDebug() << Q_FUNC_INFO;
        QVariantList data;

        foreach( const SpotifyPlaylists::LoadedPlaylist pl, SpotifySession::getInstance()->Playlists()->getPlaylists() )
        {
            if( pl.playlist_ != NULL && sp_playlist_is_loaded(pl.playlist_) )
            {
                QVariantMap playlist;
                playlist.insert( "name", QString( sp_playlist_name( pl.playlist_ ) ).replace( "\"", "\'" ) );
                playlist.insert( "id", QString( pl.id_ ) );
                playlist.insert( "track_count", pl.tracks_.count() );
                data << playlist;


            }
        }

        //response.append( QxtJSON::stringify( data ) );
    }

    if( response.isEmpty( ) )
        if( !SpotifySession::getInstance()->isPlaylistContainerLoaded() )
            qDebug() << "Still loading playlists..."; //response.append( QxtJSON::stringify( "Still loading playlists...." ) );
       else
            qDebug() << "No pls.."; //response.append( QxtJSON::stringify( "No playlists...." ) );

        QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, response );
        wpe->status = 202;
        wpe->statusMessage = "OK";
        wpe->contentType = JSON;
        postEvent( wpe );



    return;
}


