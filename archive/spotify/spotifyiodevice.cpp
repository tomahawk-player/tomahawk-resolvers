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
    , m_done( false )
{
}


SpotifyIODevice::~SpotifyIODevice()
{
//    qDebug() << Q_FUNC_INFO << "Destroying SpotifyIODevice:" << this;
    if ( isOpen() )
        close();
}


void
SpotifyIODevice::setDurationMSec( quint32 msec )
{
    quint32 numSamples = ( (quint64)msec * Q_UINT64_C(44100) ) / (quint64)1000;
    quint32 dataChunkSize = numSamples * 2 * 2;
//    qDebug() << "Writing number of samples and data chunk size:" << numSamples << dataChunkSize << "and msec:" << msec;
    // got samples, we can make the header now
    m_header += (const char* )"RIFF";
    quint32 data = 36 + dataChunkSize;
    m_header.append((char*)&data, 4); // The file size LESS the size of the "RIFF" description (4 bytes) and the size of file description (4 bytes). This is usually file size - 8, or 36 + subchunk2 size
    m_header += (const char* )"WAVE"; //The ascii text string "RIFF". mmsystem.h provides the macro FOURCC_RIFF for this purpose.
    /// fmt subchunk
    m_header += (const char* )"fmt "; //
    data = 16;
    m_header.append((char*)&data, 4); // The size of the WAVE type format (2 bytes) + mono/stereo flag (2 bytes) + sample rate (4 bytes) + bytes/sec (4 bytes) + block alignment (2 bytes) + bits/sample (2 bytes). This is usually 16 (or 0x10).
    data = 1;
    m_header.append((char*)&data, 2); // Type of WAVE format. This is a PCM header, or a value of 0x01.
    data = 2;
    m_header.append((char*)&data, 2); // mono (0x01) or stereo (0x02)
    data = 44100;
    m_header.append((char*)&data, 4); // Sample rate.
    data = 44100 * 2 * 16/8;
    m_header.append((char*)&data, 4); // Bytes/Second == SampleRate * NumChannels * BitsPerSample/8
    data = 2 * 16/8;
    m_header.append((char*)&data , 2); // Data block size (bytes) == NumChannels * BitsPerSample/8
    data = 16;
    m_header.append((char*)&data, 2); // bits per sample
    /// data subchunk
    m_header += "data" ;
    m_header.append((char*)&dataChunkSize, 4); // NumSamples * NumChannels * BitsPerSample/8
}


void
SpotifyIODevice::clear()
{
    QMutexLocker l( &m_mutex );

    m_audioData.clear();
}


qint64
SpotifyIODevice::readData( char* data, qint64 maxlen )
{
    QMutexLocker l( &m_mutex );

    qint64 written = 0;

    if ( !m_header.isEmpty() && m_header.size() < maxlen ) {
        qMemCopy( data, m_header.constData(), m_header.size() );
        qDebug() << "wrote header:" << m_header.toHex();
        written += m_header.size();

        m_header.clear();
    }

    if ( !m_audioData.isEmpty() )
    {
        const int toWrite = maxlen - written;
        const int canWrite = qMin( toWrite, m_audioData.size() );
        memcpy( data, m_audioData.data(), canWrite );
        written += canWrite;

        m_audioData = m_audioData.mid( canWrite );
        m_audioData.squeeze();
    }

    Q_ASSERT( m_audioData.size() == 0 || written == maxlen );

    return written;
}


qint64
SpotifyIODevice::writeData( const char* data, qint64 len )
{
    if ( m_done )
    {
        // do nothing
        return -1;
    }

    QMutexLocker l( &m_mutex );

    m_audioData.append( data, len );
    emit readyRead();

    return len;
}


qint64
SpotifyIODevice::bytesAvailable() const
{
    QMutexLocker l( &m_mutex );

    return m_header.size() + m_audioData.size();
}


void
SpotifyIODevice::disconnected()
{
    QMutexLocker l( &m_mutex );

    m_done = true;
    qDebug() << "spotifyiodevice disconnected";
    m_audioData.clear();
}

