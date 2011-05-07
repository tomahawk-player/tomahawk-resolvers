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


#ifndef AUDIOHTTPTHREAD_H
#define AUDIOHTTPTHREAD_H

#include <QThread>
#include <QMutex>

class QTcpSocket;

class AudioHTTPWorker : public QObject
{
    Q_OBJECT
public:
    explicit AudioHTTPWorker( int socket, QObject* parent = 0 );
    virtual ~AudioHTTPWorker();

public slots:
    void init();
    void incomingData();
    void stop();

    // if the slot is called it means we're being killed when we're not in the inner
    // audio loop anymore (otherwise no events get delivered and we rely on stop() to set the flag
    // that breaks us out of it
    void forceStop();

signals:
    void error( int errno, const QString& errStr );
    void finished();

private:
    void sendEmptyNoise();

    void doStop();
    void sendErrorResponse();

    int m_socketId;
    QTcpSocket* m_socket;
    QString m_uid;

    QMutex m_stopMutex;
    bool m_stop;
};

#endif // AUDIOHTTPTHREAD_H
