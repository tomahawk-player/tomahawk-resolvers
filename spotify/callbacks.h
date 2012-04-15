/**  This file is part of QT SpotifyWebApi - <hugolm84@gmail.com> ===
 *
 *   Copyright 2011-2012, Hugo Lindström <hugolm84@gmail.com>
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
#ifndef CALLBACKS_H
#define CALLBACKS_H
#include <libspotify/api.h>
#include "spotifysession.h"
#include "spotifyplayback.h"
#include "spotifyplaylists.h"
#include <csignal>

using namespace std;

namespace SpotifyCallbacks{


/**
    Clean exit, to call dtors when sigint
**/
struct CleanExit{
    CleanExit() {
        signal(SIGINT, &CleanExit::exitQt);
        signal(SIGTERM, &CleanExit::exitQt);
    }

    static void exitQt(int sig) {
        QCoreApplication::exit(0);
    }
};



static sp_session_callbacks callbacks = {

    &SpotifySession::loggedIn,
    &SpotifySession::loggedOut,
    NULL, //&SpotifySession::metadataUpdated,
    &SpotifySession::connectionError,
    NULL, //&SpotifySession::messageToUser,
    &SpotifySession::notifyMainThread,
    &SpotifyPlayback::musicDelivery,
    &SpotifyPlayback::playTokenLost,
    &SpotifySession::logMessage,
    &SpotifyPlayback::endOfTrack,
    &SpotifyPlayback::streamingError,
    #if SPOTIFY_API_VERSION > 4
    NULL, //&SpotifySession::userinfoUpdated,
    &SpotifyPlayback::startPlayback,
    &SpotifyPlayback::stopPlayback,
    &SpotifyPlayback::getAudioBufferStats,
    #else
    &SpotifySession::userinfoUpdated,
    #endif
    NULL,
    NULL,

};

static sp_playlistcontainer_callbacks containerCallbacks = {

    &SpotifyPlaylists::playlistAddedCallback,
    &SpotifyPlaylists::playlistRemovedCallback,
    &SpotifyPlaylists::playlistMovedCallback,
    &SpotifyPlaylists::playlistContainerLoadedCallback,


};

static sp_playlist_callbacks playlistCallbacks = {

        NULL, //&SpotifyPlaylists::tracks_added,
        NULL, //&SpotifyPlaylists::tracks_removed,
        NULL, //&SpotifyPlaylists::tracks_moved,
        &SpotifyPlaylists::playlistRenamed,
        &SpotifyPlaylists::stateChanged,
        &SpotifyPlaylists::playlistUpdateInProgress,
        &SpotifyPlaylists::playlistMetadataUpdated,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
};

static sp_playlist_callbacks syncPlaylistCallbacks = {

        &SpotifyPlaylists::tracksAdded,
        &SpotifyPlaylists::tracksRemoved,
        &SpotifyPlaylists::tracksMoved,
        &SpotifyPlaylists::playlistRenamed,
        &SpotifyPlaylists::syncStateChanged,
        &SpotifyPlaylists::playlistUpdateInProgress,
        &SpotifyPlaylists::playlistMetadataUpdated,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
};


}


#endif // CALLBACKS_H
