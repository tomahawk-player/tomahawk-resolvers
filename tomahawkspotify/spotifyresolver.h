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
#include "spotifyiodevice.h"

#include <libspotify/api.h>

#include <QCoreApplication>
#include <QTimer>
#include <QThread>
#include <QVariant>
#include <QMutex>
#include <QWaitCondition>
#include <QQueue>

#define sApp static_cast< SpotifyResolver* >( QCoreApplication::instance() )

class QxtHttpSessionManager;
struct AudioData;
class AudioHTTPServer;
class ConsoleWatcher;
class QSocketNotifer;

typedef QSharedPointer< SpotifyIODevice > spotifyiodev_ptr;

class SpotifyResolver : public QCoreApplication
{
    Q_OBJECT
public:
    SpotifyResolver( int argc, char** argv );
    virtual ~SpotifyResolver();

    void setLoggedIn( bool loggedIn );

    void sendNotifyThreadSignal();

    void search( const QString& qid, const QString& artist, const QString& track );

    // adds a track to the link map, returns a unique ID for identifying it
    QString addToTrackLinkMap( sp_link* link );
    void removeFromTrackLinkMap( const QString& linkStr );
    sp_link* linkFromTrack( const QString& linkStr );
    bool hasLinkFromTrack( const QString& linkStr );

    // audio data stuff
    QMutex& dataMutex();
    // only call if you are holding the dataMutex() from above
    void queueData( const AudioData& data );
    // will emit readyRead() when it has data.
    spotifyiodev_ptr getIODeviceForNewTrack( uint durationMsec );

    // called by callback when track is over
    void startPlaying();
    void endOfTrack();
    bool trackIsOver();

    sp_session* session() const { return m_session; }
    AudioHTTPServer* handler() const { return m_handler; }

    void sendMessage( const QVariant& v );

    static QString dataDir();

private slots:
    void notifyMainThread();
    void playdarMessage( const QVariant& );

signals:
    void notifyMainThreadSignal();

private:
    void sendConfWidget();
    void sendSettingsMessage();
    void loadSettings();
    void saveSettings() const;

    void login();

    QThread m_stdinThread;
    ConsoleWatcher* m_stdinWatcher;

    QxtHttpServerConnector m_connector;
    QxtHttpSessionManager m_httpS;
    AudioHTTPServer* m_handler;

    spotifyiodev_ptr m_iodev;

    QMutex m_dataMutex;

    sp_session_config m_config;
    sp_session *m_session;
    bool m_loggedIn;
    bool m_trackEnded;

    QHash< QString, sp_link* > m_trackLinkMap;

    QByteArray m_configWidget;
    QString m_username;
    QString m_pw;
};


#endif // tomahawkspotify_H
