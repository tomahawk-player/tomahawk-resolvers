/**  This file is part of QT SpotifyWebApi - <hugolm84@gmail.com> ===
 *   Copyright (c) 2011 Leo Franchi <leo@kdab.com>
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

#ifndef SPOTIFYPLAYBACK_H
#define SPOTIFYPLAYBACK_H
#include <libspotify/api.h>
#include <QMutex>
#include <QDebug>
#include <QSharedPointer>
#include <QObject>
#include "spotifyiodevice.h"
//#include "spotifysession.h"

typedef QSharedPointer< SpotifyIODevice > spotifyiodev_ptr;

class SpotifyPlayback : public QObject
{
    Q_OBJECT
public:
    explicit SpotifyPlayback(QObject *parent = 0);

    // Internal libspotify methods and data
    QMutex& dataMutex();
    void queueData( const QByteArray& data );
    void startPlaying();
    void endTrack();
    bool trackIsOver();

    void startPlayingTrack( sp_track *);

    spotifyiodev_ptr getIODeviceForNewTrack( uint durMsec );
    static int SP_CALLCONV musicDelivery(sp_session *session, const sp_audioformat *format, const void *frames, int numFrames_);
    static void SP_CALLCONV playTokenLost(sp_session *session)
    {
        Q_UNUSED(session);
        qDebug() << "Playtoken lost!";

    }

    static void SP_CALLCONV endOfTrack(sp_session *session);

    static void SP_CALLCONV streamingError(sp_session *session, sp_error error)
    {
        Q_UNUSED(session);
        Q_UNUSED(error);
        qDebug() << "Streaming error!";
    }


    #if SPOTIFY_API_VERSION > 4
    static void SP_CALLCONV startPlayback(sp_session *session)
    {
        Q_UNUSED(session);
        qDebug() << "Starting playback";

    }

    static void SP_CALLCONV stopPlayback(sp_session *session)
    {
        Q_UNUSED(session);
        qDebug() << "Stopping playback";
    }

    static void SP_CALLCONV getAudioBufferStats(sp_session *session, sp_audio_buffer_stats *stats)
    {
        Q_UNUSED(session);
        Q_UNUSED(stats);

    }
    #endif

private:
     QMutex m_dataMutex;
     spotifyiodev_ptr m_iodev;
     bool m_trackEnded;
};

#endif // SPOTIFYPLAYBACK_H
