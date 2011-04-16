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


#include "audiohttpserver.h"

#include "spotifyresolver.h"
#include "QxtWebPageEvent"
#include "spotifyiodevice.h"

#include <QString>
#include <QDebug>

AudioHTTPServer::AudioHTTPServer( QxtAbstractWebSessionManager* sm, int port, QObject* parent )
    : QxtWebSlotService( sm, parent )
    , m_port( port )
{
    qDebug() << "NEW AUDIO HTTP SERVER!";
}


void AudioHTTPServer::sid( QxtWebRequestEvent* event, QString a )
{
    qDebug() << QThread::currentThreadId() << "HTTP" << event->url.toString() << a;

    if( !sApp->trackIsOver() ) {
        sApp->endOfTrack();
    }

    // the requested track
    QString uid = a.replace( ".wav", "");
    qDebug() << QThread::currentThreadId() << "Beginning to stream requested track:" << uid;
    if( uid.isEmpty() || !sApp->hasLinkFromTrack( uid ) ) {
        qWarning() << "Did not find spotify track UID in our list!" << uid;
        sendErrorResponse( event );

        return;
    }

    // get the sp_track
    sp_link* link = sApp->linkFromTrack( uid );

    sp_track* track = sp_link_as_track( link );
    if( !track ) {
        qWarning() << QThread::currentThreadId() << "Uh oh... got null track from link :(" << sp_link_type( link );
        sendErrorResponse( event );
        return;
    }
    if( !sp_track_is_loaded( track ) ) {
        qWarning() << QThread::currentThreadId() << "uh oh... track not loaded yet! Asked for:" << sp_track_name( track );
        sendErrorResponse( event );
        return;
    }

    // yay we gots a track
    qDebug() << QThread::currentThreadId() << "We got a track!" << sp_track_name( track ) << sp_artist_name( sp_track_artist( track, 0 ) ) << sp_track_duration( track );
//     uint duration = 16 * 44100 * sp_track_duration( track ) / 1000;

    sp_error err = sp_session_player_load( sApp->session(), track );
    if( err != SP_ERROR_OK ) {
        qWarning() << QThread::currentThreadId() << "Failed to start track from spotify :(" << sp_error_message( err );
        sendErrorResponse( event );
        return;
    }

    qDebug() << QThread::currentThreadId() << "Starting to play!";
    sp_session_player_play( sApp->session(), true );
    sApp->startPlaying();

    qDebug() << "Getting iodevice...";
    spotifyiodev_ptr iodev = sApp->getIODeviceForCurTrack();
    qDebug()  << QThread::currentThreadId() << "Got iodevice to send:" << iodev << iodev.isNull() << iodev->isSequential() << iodev->isReadable();
    QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, iodev );
    wpe->streaming = true;
    wpe->contentType = "audio/basic";
    postEvent( wpe );

}

AudioHTTPServer::~AudioHTTPServer()
{

}


QString AudioHTTPServer::urlForID( const QString& id )
{
    return QString( "http://localhost:%1/sid/%2.wav" ).arg( m_port ).arg( id );
}

void
AudioHTTPServer::sendErrorResponse( QxtWebRequestEvent* event )
{
    qDebug() << "404" << event->url.toString();
    QxtWebPageEvent* wpe = new QxtWebPageEvent( event->sessionID, event->requestID, "<h1>No Such Track</h1>" );
    wpe->status = 403;
    wpe->statusMessage = "no track found";
    postEvent( wpe );
}


#include "audiohttpserver.moc"
