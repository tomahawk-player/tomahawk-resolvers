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


#ifndef AUDIOHTTPSERVER_H
#define AUDIOHTTPSERVER_H

#include <QObject>
#include "qxtwebslotservice.h"

class QxtWebRequestEvent;
class QxtWebPageEvent;

class AudioHTTPServer : public QxtWebSlotService
{
    Q_OBJECT
public:
    explicit AudioHTTPServer( QxtAbstractWebSessionManager* sm, int port, QObject* parent = 0 );
    virtual ~AudioHTTPServer();

    QString urlForID( const QString& id );

public slots:
    void sid(QxtWebRequestEvent* event, QString a);

private:
    void sendErrorResponse( QxtWebRequestEvent* event );

    int m_port;
};

#endif // AUDIOHTTPSERVER_H
