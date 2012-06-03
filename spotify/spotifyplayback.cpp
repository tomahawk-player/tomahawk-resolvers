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

#include <stdint.h>

SpotifyPlayback::SpotifyPlayback(QObject *parent) :
    QObject(parent),
    m_trackEnded( false )
{
}


QMutex&
SpotifyPlayback::dataMutex()
{
    return m_dataMutex;
}


void
SpotifyPlayback::clearData()
{
    if( m_iodev.isNull() )
    {
        qWarning() << "Help! Asked to clear dat but iodevice is null...";
        return;
    }

    m_iodev->clear();
}


void
SpotifyPlayback::queueData( const QByteArray& data )
{
    if( m_iodev.isNull() )
    {
        qWarning() << "Help! Got data to queue but no iodevice to queue it in...";
        return;
    }

     m_iodev->write( data );

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
        m_iodev = spotifyiodev_ptr( new SpotifyIODevice(), &QObject::deleteLater );
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
        sp_session_player_unload(SpotifySession::getInstance()->Session());
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
//     qDebug() << "Got spotify end of track callback!";
    if ( !_session->Playback()->trackIsOver() )
        _session->Playback()->endTrack();

}

int
SpotifyPlayback::musicDelivery(sp_session *session, const sp_audioformat *format, const void *frames, int numFrames_)
{
    SpotifySession* _session = reinterpret_cast<SpotifySession*>(sp_session_userdata(session));
    Q_ASSERT (_session);

    QMutex &m = _session->Playback()->dataMutex();

    _session->Playback()->m_currChannels = format->channels;
    _session->Playback()->m_currFrames = numFrames_;
    _session->Playback()->m_currSamples = format->sample_rate;

    if (numFrames_ == 0) // flush caches
    {
        QMutexLocker l(&m);
        _session->Playback()->clearData();
        return 0;
    }

    m.lock();
    // libspotify v11 bug, seems to retry to push the last batch of audio no matter what. short-circuit to ignore
    if ( _session->Playback()->trackIsOver() ) {
        m.unlock();
        return numFrames_;
    }

    const QByteArray data( (const char*)frames, numFrames_ * 4 ); // 4 == channels * ( bits per sample / 8 ) == 2 * ( 16 / 8 ) == 2 * 2
    _session->Playback()->queueData( data );
    m.unlock();

    return numFrames_; // num frames read, not bytes read. we always read all the frames
}
