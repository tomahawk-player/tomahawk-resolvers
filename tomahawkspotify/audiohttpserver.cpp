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

#include <QTcpServer>
#include "audiohttpworker.h"

AudioHTTPServer::AudioHTTPServer(QObject* parent)
    : QTcpServer( parent )
    , m_curthread( 0 )
    , m_worker( 0 )
{
    listen( QHostAddress::Any );
}

AudioHTTPServer::~AudioHTTPServer()
{
    if( m_worker )
        m_worker->deleteLater();

    if( m_curthread ) {
        m_curthread->terminate();
        delete m_curthread;
    }
}


QString AudioHTTPServer::urlForID( const QString& id )
{
    return QString( "http://localhost:%1/%2.wav" ).arg( serverPort() ).arg( id );
}


void AudioHTTPServer::incomingConnection( int handle )
{
    qDebug() << "Got incoming connection!";
    qDebug() << "current status:" << m_worker << m_curthread;
    if( m_worker && m_curthread ) {
        qDebug() << "got new connection and have still existing open connection:" << m_worker << m_curthread;
        m_worker->stop();
        QMetaObject::invokeMethod( m_worker, "forceStop", Qt::QueuedConnection );

        connect( m_worker, SIGNAL( finished() ), m_worker, SLOT( deleteLater() ), Qt::UniqueConnection );
        connect( m_worker, SIGNAL( destroyed( QObject* ) ), m_curthread, SLOT( quit() ), Qt::UniqueConnection );
        connect( m_curthread, SIGNAL( finished() ), m_curthread, SLOT( deleteLater() ), Qt::UniqueConnection );

    }
    qDebug() << "Destroyed old thread! starting next....";

    m_curthread = new QThread;
    m_worker = new AudioHTTPWorker( handle, 0 );

    m_worker->moveToThread( m_curthread );
    QMetaObject::invokeMethod( m_worker, "init", Qt::QueuedConnection );

    qDebug() << "kicking off next worker thread...";
    m_curthread->start();

/*
    if( !m_worker && !m_curthread ) {
        qDebug() << "Starting directly since no existing connection to kill first:" << m_worker << m_curthread;
        startNextWorker();
    }*/
}
/*
void AudioHTTPServer::startNextWorker()
{
    qDebug() << Q_FUNC_INFO << "Starting next worker!";
    if( m_curthread ) {
        delete m_curthread;
        m_curthread = 0;
    }

    if( !m_nextWorker ) {
        qWarning() << Q_FUNC_INFO << "BAD NEWS BEARS, next worker deleted under us!";
        return;
    }

    m_curthread = new QThread;
    m_worker = m_nextWorker;

    m_worker->moveToThread( m_curthread );
    QMetaObject::invokeMethod( m_worker, "init", Qt::QueuedConnection );

    qDebug() << "kicking off next worker thread...";
    m_curthread->start();

    m_nextWorker = 0;
}*/


#include "audiohttpserver.moc"
