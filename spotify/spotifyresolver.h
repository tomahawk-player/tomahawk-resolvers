/*
    Copyright (c) 2011-2012 Leo Franchi <lfranchi@kde.org>
    Copyright (c) 2012 Hugo Lindström <hugolm84@gmail.com>

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
#include "spotifyplaylists.h"
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
class SpotifyResolver;

typedef QHash<QString, QString > CacheEntry;

struct UserData
{
    QString qid;
    bool fulltext;
    SpotifyResolver* resolver;
    int searchCount;

    UserData( const QString& qidd, SpotifyResolver* resolverr )
        : qid( qidd ), fulltext( false ), resolver( resolverr ), searchCount( 0 )
    {}
};

struct StarData
{
    QString artist, track;
    bool starred;

    StarData( const QString& _artist, const QString& _track, bool _starred )
        : artist(_artist), track(_track), starred(_starred) {}
};

class SpotifyResolver : public QCoreApplication
{
    Q_OBJECT
public:

    explicit SpotifyResolver( int& argc, char** argv );
    virtual ~SpotifyResolver();

    void search( const QString& qid, const QString& artist, const QString& track, const QString& fullText, const QString& resultHint = QString() );
    void albumSearch( const QString& album, const QString& artist, const QString& qid );

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
    bool highQuality() const { return m_highQuality; }

    void sendAddTracksResult( const QString& spotifyId, QList<int> tracksInserted, QList<QString> insertedIds, bool result );
    QVariantMap spTrackToVariant(sp_track* track );
    void sendAlbumSearchResult( const QString& qid, const QString& albumName, const QString& artistName, const QList<sp_track*> tracks);
    bool ignoreNextUpdate() const { return m_ignoreNextUpdate; }
    void setIgnoreNextUpdate( bool ignore ) { m_ignoreNextUpdate = ignore; }

    void registerQidForPlaylist( const QString& qid, const QString& playlist );

public slots:
    void setup();
    void instanceStarted( KDSingleApplicationGuard::Instance );

private slots:
    void playdarMessage( const QVariant& );
    void initSpotify();
    void loginResponse( bool success, const QString& msg );
    void notifyAllPlaylistsLoaded();
    void resendAllPlaylists();
    void errorMsgReceived( sp_error );
    void errorMsgReceived( const QString &msg, bool isDebug );
    void sendPlaylist( const SpotifyPlaylists::LoadedPlaylist& );
    void sendPlaylistMetadataChanged( const SpotifyPlaylists::LoadedPlaylist& );
    void sendTracksAdded( sp_playlist* pl, const QList< sp_track* >& tracks, const QString& positionId );
    void sendStarredChanged( sp_playlist* pl, const QList< sp_track* >& tracks, const bool starred );
    void sendTracksRemoved( sp_playlist* pl, const QStringList& tracks );
    void sendTracksMoved( sp_playlist* pl, const QStringList& tracks, const QString& positionId );
    void sendPlaylistDeleted( const QString& playlist );
    void sendPlaylistListing( sp_playlist* pl, const QString& plid  );
    bool useResultHint(const QString& qid, sp_link *resultHintLink );
    void userChangedReceived();
    void updateBlob( const QByteArray& username, const QByteArray& blob );
    void getStatus();

private:
    void sendSettingsMessage();
    void loadSettings();
    void saveSettings() const;
    void login();
    void clearTrackLinkMap();
    void searchAndStarrTrack(const QString& artist, const QString& track, const bool starred);
    void gotStatus();
    void updatePrivacy();

    // Session
    SpotifySession *m_session;
    int m_port;

    // STDin
    QThread m_stdinThread;
    ConsoleWatcher* m_stdinWatcher;

    // Cache
    QHash< QString, sp_link* > m_trackLinkMap;

    // Http
    QxtHttpServerConnector m_connector;
    QxtHttpSessionManager m_httpS;
    AudioHTTPServer* m_handler;

    // Spotify
    QByteArray m_apiKey;
    QByteArray m_configWidget;
    QList< QVariantMap > m_savedTracks;
    // Callback QIDs
    QHash< QString, QString > m_playlistToQid;

    QString m_username;
    QString m_pw;
    QByteArray m_blob;

    bool m_highQuality;
    bool m_loggedIn;
    bool m_ignoreNextUpdate;

    QTimer* m_statusTimer;
    bool m_foundTomahawkInstance;
    bool m_haveSentStatus;
    bool m_privateSession;
};

bool checkTrackIsLoaded( sp_track* track );
Q_DECLARE_METATYPE( CacheEntry )
Q_DECLARE_METATYPE( sp_search* )
Q_DECLARE_METATYPE( sp_track* )
Q_DECLARE_METATYPE( void* )
Q_DECLARE_METATYPE( SpotifyPlaylists::LoadedPlaylist )
Q_DECLARE_METATYPE( sp_link* )
#endif // tomahawkspotify_H

