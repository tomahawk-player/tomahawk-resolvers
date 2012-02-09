/**  This file is part of QT SpotifyWebApi - <hugolm84@gmail.com> ===
 *
 *   Copyright 2011-2012,Hugo Lindström <hugolm84@gmail.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 */
#ifndef SPOTIFYHTTPSERVER_H
#define SPOTIFYHTTPSERVER_H

#include <QxtHttpServerConnector>
#include <QxtHttpSessionManager>
#include <QxtWebSlotService>
#include <QxtWebPageEvent>
#include <QObject>
#include <QVariant>

#include <libspotify/api.h>
#include "spotifysession.h"
#include "callbacks.h"


#define JSON "application/json; charset=UTF-8";

class QxtWebRequestEvent;
class QxtWebPageEvent;

class SpotifyHTTPServer : public QxtWebSlotService
{
    Q_OBJECT
public:
    explicit SpotifyHTTPServer( QxtAbstractWebSessionManager* sm, int port, QObject* parent = 0 );

public slots:
    void index(QxtWebRequestEvent* event);
    void playlist(QxtWebRequestEvent* event, QString id);
    void playlists(QxtWebRequestEvent* event);
    void sync(QxtWebRequestEvent* event, QString id);
    void play(QxtWebRequestEvent* event, QString id);
private slots:
    void checkForLoaded();
private:
    void startStreamingResponse( QxtWebRequestEvent* event, sp_track* );
    void sendErrorResponse( QxtWebRequestEvent* event );
    int m_port;
    // If we need to wait for them to be loaded. Ugh.
    QxtWebRequestEvent* m_savedEvent;
    sp_track* m_savedTrack;

};
#endif // SPOTIFYHTTPSERVER_H
