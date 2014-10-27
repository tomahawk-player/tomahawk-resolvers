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


#ifndef CONSOLEWATCHER_H
#define CONSOLEWATCHER_H

#include <QObject>
#include <QString>
#include <qvariant.h>

class QFile;
class QTimer;

class ConsoleWatcher : public QObject
{
    Q_OBJECT
public:
    ConsoleWatcher( QObject* parent = 0 );
    virtual ~ConsoleWatcher();

public slots:
    void checkStdin();

signals:
    void lineRead( const QVariant& line );

private slots:
    void parseMsg( const QByteArray& msg );

private:
    QFile* m_stdin;
    QTimer* m_timer;
    quint32 m_msgsize;
    QByteArray m_curmsg;
};

#endif // CONSOLEWATCHER_H
