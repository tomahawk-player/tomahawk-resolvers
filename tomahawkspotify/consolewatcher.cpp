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


#include "consolewatcher.h"

#include "spotifyresolver.h"

#include <QTimer>
#include <QTextStream>
#include <QDebug>
#include <parser.h>
#include <qvariant.h>
#include <qfile.h>
#include <qendian.h>

ConsoleWatcher::ConsoleWatcher( QObject* parent)
    : QObject( parent )
    , m_stdin( 0 )
    , m_timer( new QTimer( this ) )
    , m_msgsize( 0 )
{
    m_stdin = new QFile( this );
    if( !m_stdin->open( stdin, QIODevice::ReadOnly | QIODevice::Unbuffered ) )
        qWarning() << "FAILED TO OPEN STDIN!";

    m_timer->setInterval( 100 );
    connect( m_timer, SIGNAL( timeout() ), this, SLOT( checkStdin() ) );
    m_timer->start();
}

ConsoleWatcher::~ConsoleWatcher()
{

}

void ConsoleWatcher::checkStdin()
{
//     qDebug() << "checking stdin:" << m_stdin->bytesAvailable() << m_msgsize << m_curmsg;
    if( m_msgsize == 0 )
    {

//         if( m_stdin->bytesAvailable() < 4 ) return;
        quint32 len_nbo;
        m_stdin->read( (char*) &len_nbo, 4 );
        m_msgsize = qFromBigEndian( len_nbo );
    }

    if( m_msgsize > 0 )
    {
        m_curmsg.append( m_stdin->read( m_msgsize - m_curmsg.length() ) );
    }

    if( m_msgsize == (quint32) m_curmsg.length() ) // got the full message
    {
        parseMsg( m_curmsg );
        m_msgsize = 0;
        m_curmsg.clear();
    }

}

void ConsoleWatcher::parseMsg(const QByteArray& msg)
{
    QJson::Parser p;
//     qDebug() << "GOT UNPARSED STDIN:" << msg;
    QVariant json = p.parse( msg );

     if( json.isValid() )
         emit lineRead( json );
}


#include "consolewatcher.moc"