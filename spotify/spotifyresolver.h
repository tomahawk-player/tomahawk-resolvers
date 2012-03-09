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

#ifndef tomahawkspotify_H
#define tomahawkspotify_H

#include "QxtHttpServerConnector"
#include "qxthttpsessionmanager.h"
#include "kdsingleapplicationguard/kdsingleapplicationguard.h"

#include <libspotify/api.h>

#include <QCoreApplication>
#include <QTimer>
#include <QThread>
#include <QVariant>
#include <QMutex>
#include <QWaitCondition>
#include <QQueue>
#include "spotifysession.h"
#include "audiohttpserver.h"
#define sApp static_cast< SpotifyResolver* >( QCoreApplication::instance() )

class QxtHttpSessionManager;

class ConsoleWatcher;

typedef QHash<QString, QString > CacheEntry;

class SpotifyResolver;
struct UserData {
    QString qid;
    bool fulltext;
    SpotifyResolver* resolver;

    UserData( const QString& qidd, SpotifyResolver* resolverr ) : qid( qidd ), fulltext( false ), resolver( resolverr ) {}
};

class SpotifyResolver : public QCoreApplication
{
    Q_OBJECT
public:

    explicit SpotifyResolver( int& argc, char** argv );
    virtual ~SpotifyResolver();
    void setup();

    void search( const QString& qid, const QString& artist, const QString& track, const QString& fullText );

    // adds a track to the link map, returns a unique ID for identifying it
    QString addToTrackLinkMap( sp_link* link );
    void removeFromTrackLinkMap( const QString& linkStr );
    sp_link* linkFromTrack( const QString& linkStr );
    bool hasLinkFromTrack( const QString& linkStr );

    AudioHTTPServer* handler() const { return m_handler; }
    static QString dataDir( bool configDir = false );
    void sendMessage( const QVariant& v );

    int port() const { return m_port; }
    SpotifySession* session() const { return m_session; }

public slots:
    void instanceStarted( KDSingleApplicationGuard::Instance );

private slots:
    void playdarMessage( const QVariant& );
    void loadCache();
    void saveCache();
    void initSpotify();
    void notifyLoggedIn();
    void notifySyncUpdate( SpotifyPlaylists::LoadedPlaylist );
    void notifyStarredUpdate( SpotifyPlaylists::LoadedPlaylist );

private:
    void sendConfWidget();
    void sendSettingsMessage();
    void loadSettings();
    void saveSettings() const;
    void login();

    // Session
    SpotifySession *m_session;
    int m_port;

    // STDin
    QThread m_stdinThread;
    ConsoleWatcher* m_stdinWatcher;

    // Cache
    QHash< QString, sp_link* > m_trackLinkMap;
    bool m_dirty;
    CacheEntry m_cachedTrackLinkMap;

    // Http
    QxtHttpServerConnector m_connector;
    QxtHttpSessionManager m_httpS;
    AudioHTTPServer* m_handler;

    // Spotify
    QByteArray m_apiKey;
    QByteArray m_configWidget;

    QString m_username;
    QString m_pw;

    bool m_highQuality;
    bool m_loggedIn;

};

Q_DECLARE_METATYPE( CacheEntry )

#endif // tomahawkspotify_H
