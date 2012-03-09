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

#ifndef MAIN_H
#define MAIN_H

#include <libspotify/api.h>
class QxtHttpSessionManager;
class SpotifyHTTPServer;
class QSocketNotifer;



/** EXAMPLE **/
/*
QCoreApplication a(argc, argv);

//  Sometimes location causes errors, so if your not able
//  to login, change the location or rm the dirs + trace

sessionConfig config;
config.cache_location = "/tmp";
config.settings_location = "/tmp";
config.application_key = g_appkey;
config.application_key_size = g_appkey_size;
config.user_agent = "spotifyApi";
config.tracefile = "/tmp/trace.dat";
config.device_id = "spotifyApi";


SpotifySession *Spotify = new SpotifySession(config);
Spotify->setCredentials( "username", "password");
Spotify->login();

Spotify->qid = "134";
QString query = "Madonna";
sp_search_create( Spotify->Session(), query.toUtf8().data(), 0, 25, 0, 0, 0, 0, &SpotifySearch::searchComplete, Spotify );

QxtHttpServerConnector connector;
QxtHttpSessionManager hsession;
SpotifyHTTPServer* handler;


hsession.setPort( 55050 );
hsession.setListenInterface( QHostAddress::LocalHost );
hsession.setConnector( &connector );

handler = new SpotifyHTTPServer( &hsession, hsession.port() );
hsession.setStaticContentService( handler );

qDebug() << "Starting HTTPd on" << hsession.listenInterface().toString() << hsession.port();
hsession.start();
*/
/** END EXAMPLE **/

#endif // MAIN_H
