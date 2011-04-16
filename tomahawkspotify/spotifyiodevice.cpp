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

#include "spotifyiodevice.h"
#include "callbacks.h"

SpotifyIODevice::SpotifyIODevice( QObject* parent )
    : QIODevice( parent )
    , m_curSum( 0 )
    , m_done( false )
{
}

SpotifyIODevice::~SpotifyIODevice()
{
    if( isOpen() )
        close();
}

qint64 SpotifyIODevice::readData( char* data, qint64 maxlen )
{
    QMutexLocker l( &m_mutex );

    qint64 written = 0;

    while( !m_audioData.isEmpty() && written < maxlen ) {
        qint64 next = m_audioData.first().second;
        if( written + next > maxlen )
            return written;

        char* d = m_audioData.dequeue().first;
        qMemCopy( data + written, d, next );
        written += next;

        m_curSum -= next;
        free( d );
    }

    Q_ASSERT( m_curSum == 0 || written == maxlen );

    return written;
}

qint64 SpotifyIODevice::writeData( const char* data, qint64 len )
{
    if( m_done ) {
        // do nothing, just free the data
        qFree( (char*)data );
        return -1;
    }
    QMutexLocker l( &m_mutex );
    m_audioData.enqueue( QPair< char*, qint64 >( (char*)data, len ) );
    m_curSum += len;

    emit readyRead();

    return m_curSum;
}

qint64 SpotifyIODevice::bytesAvailable() const
{
    return m_curSum;
}

void SpotifyIODevice::disconnected()
{
    m_done = true;

    m_curSum = 0;
    while( !m_audioData.isEmpty() )
        qFree( m_audioData.dequeue().first );
}


#include "spotifyiodevice.moc"