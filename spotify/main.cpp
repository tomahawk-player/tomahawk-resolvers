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

#include <QtCore/QCoreApplication>
#include "spotifysession.h"
#include "main.h"
#include "spotifyresolver.h"
//#include "appkey.h"
int main(int argc, char *argv[])
{

    /** Example **/
    /*
      See main.h
    */

    SpotifyResolver app( argc, argv );
    // To force dtors
    //SpotifyCallbacks::CleanExit cleanExit;
    KDSingleApplicationGuard guard( KDSingleApplicationGuard::NoPolicy );
    QObject::connect( &guard, SIGNAL( instanceStarted( KDSingleApplicationGuard::Instance ) ), &app, SLOT( instanceStarted( KDSingleApplicationGuard::Instance )  ) );

    app.setup();
    return app.exec();

    /*
    QCoreApplication a(argc, argv);

    //  Sometimes location causes errors, so if your not able
    //  to login, change the location or rm the dirs + trace

    sessionConfig config;
    config.cache_location = "/tmp";
    config.settings_location = "/tmp";
    config.g_app_key = g_appkey;
    config.application_key_size = g_appkey_size;
    config.user_agent = "spotifyApi";
    config.tracefile = "/tmp/trace.dat";
    config.device_id = "spotifyApi";


    SpotifySession *Spotify = new SpotifySession(config);
    Spotify->setCredentials( "", "");
    Spotify->login();

   return a.exec();*/

    /** END EXAMPLE **/
}
