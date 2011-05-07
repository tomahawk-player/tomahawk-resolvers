/*
 *    Copyright (c) 2011 Leo Franchi <leo@kdab.com>
 *
 *    Permission is hereby granted, free of charge, to any person
 *    obtaining a copy of this software and associated documentation
 *    files (the "Software"), to deal in the Software without
 *    restriction, including without limitation the rights to use,
 *    copy, modify, merge, publish, distribute, sublicense, and/or sell
 *    copies of the Software, and to permit persons to whom the
 *    Software is furnished to do so, subject to the following
 *    conditions:
 *
 *    The above copyright notice and this permission notice shall be
 *    included in all copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 *    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 *    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 *    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 *    OTHER DEALINGS IN THE SOFTWARE.
 */
#ifndef SPOTIFY_IODEVICE_H
#define SPOTIFY_IODEVICE_H

#include <QIODevice>
#include <QQueue>
#include <QPair>
#include <QMutex>
#include <QFile>

class SpotifyIODevice : public QIODevice
{
    Q_OBJECT
public:
    SpotifyIODevice( QObject* parent = 0 );
    virtual ~SpotifyIODevice();

    virtual qint64 readData(char* data, qint64 maxlen);
    virtual qint64 writeData(const char* data, qint64 len);
    virtual qint64 bytesAvailable() const;
    virtual bool isSequential() const  { return true; }

    void setDurationMSec( uint msec );
    void disconnected();
private:
    QQueue< QPair< char* , qint64 > > m_audioData;
    QByteArray m_header;
    qint64 m_curSum;
    mutable QMutex m_mutex;

    bool m_done;
};

#endif
