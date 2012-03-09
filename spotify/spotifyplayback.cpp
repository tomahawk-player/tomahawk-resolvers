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


#include "spotifyplayback.h"
#include "spotifysession.h"
#include <QString>
#include <QDebug>
#include <QPair>
#include <QMutex>
#include <QThread>

SpotifyPlayback::SpotifyPlayback(QObject *parent) :
    QObject(parent)
{
}


QMutex&
SpotifyPlayback::dataMutex()
{
    return m_dataMutex;
}

void
SpotifyPlayback::queueData( const AudioData& data )
{
    if( m_iodev.isNull() )
    {
        qWarning() << "Help! Got data to queue but no iodevice to queue it in...";
        return;
    }

    m_iodev->writeData( (const char*)data.data, data.numFrames * 4 ); // 4 == channels * ( bits per sample / 8 ) == 2 * ( 16 / 8 ) == 2 * 2
}


void
SpotifyPlayback::startPlaying()
{
    m_trackEnded = false;
}

spotifyiodev_ptr
SpotifyPlayback::getIODeviceForNewTrack( uint durMsec )
{
    if( m_iodev.isNull() )
    {
        m_iodev = spotifyiodev_ptr( new SpotifyIODevice( this ) );
        m_iodev->setDurationMSec( durMsec );
        m_iodev->open( QIODevice::ReadWrite );

        qDebug() << QThread::currentThreadId() << "Creating SpotifyIODevice for track..:" << m_iodev.data() << m_iodev->thread()->currentThreadId();
    }

    return m_iodev;
}


void
SpotifyPlayback::endTrack()
{
    qDebug() << QThread::currentThreadId() << "And stopping track";
    if( !m_iodev.isNull() ) {
        qDebug() << "Stopping track and closign iodev! from thread with other:" << QThread::currentThreadId() << "and iodev:" << m_iodev->thread()->currentThreadId();
        m_iodev->close();
        m_iodev.clear();

        //sp_session_player_unload( spotifySession->Session() );

        qDebug() << "Done unloading too.";
    }
    m_trackEnded = true;
}

bool
SpotifyPlayback::trackIsOver()
{
    return m_trackEnded;
}

void
SpotifyPlayback::endOfTrack(sp_session *session)
{
    SpotifySession* _session = reinterpret_cast<SpotifySession*>( sp_session_userdata( session ) );
    qDebug() << "Got spotify end of track callback!";
    _session->Playback()->endTrack();

}

int
SpotifyPlayback::musicDelivery(sp_session *session, const sp_audioformat *format, const void *frames, int numFrames_)
{

    SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
    Q_ASSERT (_session);

    if (!numFrames_) {
        return 0;
    }

    const int numFrames = qMin(numFrames_, 8192);

    QMutex &m = _session->Playback()->dataMutex();
    m.lock();
    AudioData d;
    quint32 amount = numFrames * sizeof(int16_t) * format->channels;
    d.data = qMalloc( amount );
    memcpy( d.data, frames, amount );
    d.numFrames = numFrames;
    d.sampleRate = format->sample_rate;
    _session->Playback()->queueData( d );
    m.unlock();

    return numFrames;
}
