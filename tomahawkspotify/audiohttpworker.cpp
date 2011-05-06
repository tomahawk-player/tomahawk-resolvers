/*
    Copyright (c) 2011 Leo Franchi <leo@kdab.com>

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/


#include "audiohttpworker.h"
#include "spotifyresolver.h"

#include <QTcpSocket>
#include <QDateTime>
#include <QHttpRequestHeader>
#include "callbacks.h"
#include <stdlib.h>

AudioHTTPWorker::AudioHTTPWorker( int socket, QObject* parent )
    : QObject( parent )
    , m_socketId( socket )
    , m_stop( false )
{
}

AudioHTTPWorker::~AudioHTTPWorker()
{
    qDebug() << QThread::currentThreadId() << "AudioHTTPWorker shutting down!" << this;
}


void AudioHTTPWorker::init()
{
    m_socket = new QTcpSocket;

    qDebug() << "Started thread in wrapper:" << QThread::currentThreadId() << "thread itself:" << m_socket->thread() << "main thread:" << sApp->thread();
    if( !m_socket->setSocketDescriptor( m_socketId ) ) {
        qWarning() << "Failed to set socket descriptor on socket!" << m_socket->error() << m_socket->errorString();
        emit error( m_socket->error(), m_socket->errorString() );
    }
    qDebug() << QThread::currentThreadId() << "to read:" << m_socket->bytesAvailable();
    connect( m_socket, SIGNAL( readyRead() ), this, SLOT( incomingData() ) );

}

void AudioHTTPWorker::stop()
{
    qDebug() << QThread::currentThreadId() << "Setting stop to on";
    QMutexLocker l( &m_stopMutex );
    m_stop = true;
    qDebug() << QThread::currentThreadId() << "stop is on";
}


void AudioHTTPWorker::incomingData()
{
    QByteArray data = m_socket->readAll();
    qDebug() << QThread::currentThreadId() << "Got data:" << data;
    // we get the request for a certain song. at this point we start streaming it back to the requestor.

    // parse the header
    int pos = data.indexOf( "\r\n\r\n" );
    QHttpRequestHeader header( QString::fromUtf8( data.left( pos + 3 ) ) );
    if( header.method() != "GET" ) {
        sendErrorResponse();
        return;
    }

    // the requested track
    QString uid = header.path().replace( ".wav", "").mid( 1 ); // remove starting /
    qDebug() << QThread::currentThreadId() << "Beginning to stream requested track:" << uid;
    if( uid.isEmpty() || !sApp->hasLinkFromTrack( uid ) ) {
        qWarning() << "Did not find spotify track UID in our list!" << uid;
        sendErrorResponse();

        return;
    }

    // get the sp_track
    sp_link* link = sApp->linkFromTrack( uid );

    sp_track* track = sp_link_as_track( link );
    if( !track ) {
        qWarning() << QThread::currentThreadId() << "Uh oh... got null track from link :(" << sp_link_type( link );
        sendErrorResponse();
        return;
    }
    if( !sp_track_is_loaded( track ) ) {
        qWarning() << QThread::currentThreadId() << "uh oh... track not loaded yet! Asked for:" << sp_track_name( track );
        sendErrorResponse();
        return;
    }

    // yay we gots a track
    qDebug() << QThread::currentThreadId() << "We got a track!" << sp_track_name( track ) << sp_artist_name( sp_track_artist( track, 0 ) ) << sp_track_duration( track );
    uint duration = 16 * 44100 * sp_track_duration( track ) / 1000;
    QHttpResponseHeader response( 200, "OK", 1, 1 );
    response.setValue( "Date", QDateTime::currentDateTime().toString( Qt::ISODate ) );
    response.setValue( "Server", "TomahawkSpotify" );
//     response.setValue( "Keep-Alive", "timeout=1, max=1" );
//     response.setValue( "Connection", "Keep-Alive" );
    response.setContentType( "audio/basic" );
//     response.setContentLength( duration ); not reliable...

    m_socket->write( response.toString().toLatin1() );
    qDebug() << "wrote:" << response.toString();
    m_socket->flush();

    // start spotify track, and start waiting
    sp_error err = sp_session_player_load( sApp->session(), track );
    if( err != SP_ERROR_OK ) {
        qWarning() << QThread::currentThreadId() << "Failed to start track from spotify :(" << sp_error_message( err );
        sendErrorResponse();
        return;
    }

    sp_session_player_play( sApp->session(), true );
    sApp->startPlaying();

    // send some data so tomahawk's QNetworkReply doesn't think we're empty
    sendEmptyNoise();

    uint bytesWritten = 0;
    Q_FOREVER
    {
        {
            QMutexLocker l( &m_stopMutex );
            if( m_stop ) {
                doStop();
                qDebug() << QThread::currentThreadId() << "Stopping in audio thread because stop flag was enabled!";
                break;
            }
        }

//         qDebug() << QThread::currentThreadId() << "Checking:" << sApp->trackIsOver() << m_socket->isOpen() << m_socket->isWritable();
        if( sApp->trackIsOver() || !m_socket->isOpen() && !m_socket->isWritable() ) // die on a disconnect
            break;

        QMutex& dMutex = sApp->dataMutex();
        dMutex.lock();
        if( bytesWritten == 0 && !sApp->hasData() ) {
            // send empty noise while we wait for data from libspotify.
            // this is so that we
            dMutex.unlock();
            qDebug() << "Beginning to send empty noise while waiting for spotify";
            Q_FOREVER {
                sendEmptyNoise();

                usleep( 10000 );

                dMutex.lock();
                if( sApp->hasData() )
                    break;
                dMutex.unlock();
            };
            qDebug() << "Done sending empty noise!";
        } else {
            // we've begun playing, so block till we have real audio data
            while( !sApp->hasData() )
                sApp->dataWaitCond().wait( &dMutex );
        }

        // ok, we got some data to push through
        AudioData d = sApp->getData();
        dMutex.unlock();

        if( d.numFrames == -1 ) { // uh oh, lets just stop?
            // TODO
        }
        m_socket->write( (const char*)d.data, d.numFrames * 4 ); // 4 == channels * ( bits per sample / 8 ) == 2 * ( 16 / 8 )
        m_socket->flush();

        free( d.data );

        bytesWritten += d.numFrames * 4;
//         qDebug() << "Written:" << d.numFrames*4 << "total of:" << bytesWritten;
        if( bytesWritten % 4194304 == 0 ) // 4mb
            qDebug() << QThread::currentThreadId() << "Got data... written another 4 megabytes with total of" << (double)bytesWritten/1048576;

        usleep( 10000 );

    }
    qDebug() << QThread::currentThreadId() << "Finished streaming, wrote:" << (double)bytesWritten/1048576 << "mb";

    m_socket->close();
    emit finished();

//     sp_session_player_unload( sApp->session() );
//     sApp->endOfTrack();
}

void AudioHTTPWorker::forceStop()
{
    doStop();

    if( m_socket->isOpen() )
        m_socket->close();

//     if( !sApp->trackIsOver() ) {
//         sp_session_player_unload( sApp->session() );
//     }

    emit finished();
}

void AudioHTTPWorker::doStop()
{

    // stop any other current streams
    QMutex& m = sApp->dataMutex();
    m.lock();
    sApp->clearData();
    m.unlock();
}



void AudioHTTPWorker::sendErrorResponse()
{
    Q_ASSERT( m_socket->isOpen() );

    QByteArray resp = "HTTP/1.1 403 Forbidden\r\n\r\n";
    m_socket->write( resp );
    m_socket->flush();

    emit finished();
}

void AudioHTTPWorker::sendEmptyNoise()
{
    // send 441 frames (4091*4 amount of data)
    size_t len = 4091 * 4;
    void* d = qMalloc( len );
    qMemSet( d, 0, len );
    m_socket->write( (const char*)d, len );
    m_socket->flush();

    qFree( d );
}


#include "audiohttpworker.moc"