#ifndef GROOVESHARKRESOLVER_H
#define GROOVESHARKRESOLVER_H

#include <QObject>

class GroovesharkResolver : public QObject
{
    Q_OBJECT
public:
    explicit GroovesharkResolver(QObject *parent = 0);
    virtual ~GroovesharkResolver();

    void init();

    void search( const QString& qid, const QString& artist, const QString& track );

    // adds a track to the link map, returns a unique ID for identifying it
    QString addToTrackLinkMap( GrooveSong* song );
    void removeFromTrackLinkMap( const QString& linkStr );
    GrooveSong* linkFromTrack( const QString& linkStr );
    bool hasLinkFromTrack( const QString& linkStr );

    sp_session* session() const { return m_session; }
    AudioHTTPServer* handler() const { return m_handler; }

    void sendMessage( const QVariant& v );

    static QString dataDir();

public slots:
    void instanceStarted( KDSingleApplicationGuard::Instance );

private slots:
    void playdarMessage( const QVariant& );

private:
    void sendSettingsMessage();
    void loadSettings();
    void saveSettings() const;

    QThread m_stdinThread;
    ConsoleWatcher* m_stdinWatcher;

    QxtHttpServerConnector m_connector;
    QxtHttpSessionManager m_httpS;
    AudioHTTPServer* m_handler;

    QHash< QString, sp_link* > m_trackLinkMap;
};

#endif // GROOVESHARKRESOLVER_H
