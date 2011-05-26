#include "groovesharkresolver.h"


#ifdef Q_WS_MAC
#define LOGFILE QDir::home().filePath( "Library/Logs/GroovesharkResolver.log" ).toLocal8Bit()
#else
#define LOGFILE QDir( SpotifyResolver::dataDir() ).filePath( "GroovesharkResolver.log" ).toLocal8Bit()
#endif

#define LOGFILE_SIZE 1024 * 512
std::ofstream logfile;

void LogHandler( QtMsgType type, const char *msg )
{
    static QMutex s_mutex;

    QMutexLocker locker( &s_mutex );
    switch( type )
    {
        case QtDebugMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Debug: " << msg << "\n";
            break;

        case QtCriticalMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Critical: " << msg << "\n";
            break;

        case QtWarningMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Warning: " << msg << "\n";
            break;

        case QtFatalMsg:
            logfile << QTime::currentTime().toString().toAscii().data() << " Fatal: " << msg << "\n";
            logfile.flush();
/*
            cout << msg << "\n";
            cout.flush();*/
            abort();
            break;
    }

//     std::cout << msg << "\n";
//     cout.flush();
    logfile.flush();
}

void setupLogfile()
{
    if ( QFileInfo( LOGFILE ).size() > LOGFILE_SIZE )
    {
        QByteArray lc;
        {
            QFile f( LOGFILE );
            f.open( QIODevice::ReadOnly | QIODevice::Text );
            lc = f.readAll();
            f.close();
        }

        QFile::remove( LOGFILE );

        {
            QFile f( LOGFILE );
            f.open( QIODevice::WriteOnly | QIODevice::Text );
            f.write( lc.right( LOGFILE_SIZE - (LOGFILE_SIZE / 4) ) );
            f.close();
        }
    }

    logfile.open( LOGFILE, std::ios::app );
    qInstallMsgHandler( LogHandler );
}

GroovesharkResolver::GroovesharkResolver(QObject *parent) :
    QObject(parent)
{
    setOrganizationName( QLatin1String( "Tomahawk" ) );
    setOrganizationDomain( QLatin1String( "tomahawk-player.org" ) );
    setApplicationName( QLatin1String( "GroovesharkResolver" ) );
    setApplicationVersion( QLatin1String( "0.1" ) );
}

GroovesharkResolver::~GroovesharkResolver()
{
    delete m_stdinWatcher;
    m_stdinThread.exit();
}

void GroovesharkResolver::init()
{
    setupLogfile();

    // read stdin
    m_stdinWatcher = new ConsoleWatcher( 0 );
    connect( m_stdinWatcher, SIGNAL( lineRead( QVariant ) ), this, SLOT( playdarMessage( QVariant ) ) );
    m_stdinWatcher->moveToThread( &m_stdinThread );
    m_stdinThread.start( QThread::LowPriority );



}

void GroovesharkResolver::search( const QString& qid, const QString& artist, const QString& track )
{
}

QString GroovesharkResolver::addToTrackLinkMap( GrooveSong* song )
{
}

void GroovesharkResolver::removeFromTrackLinkMap( const QString& linkStr )
{
}

GrooveSong* GroovesharkResolver::linkFromTrack( const QString& linkStr )
{
}

bool GroovesharkResolver::hasLinkFromTrack( const QString& linkStr )
{
}

void GroovesharkResolver::sendMessage( const QVariant& v )
{
}

static QString GroovesharkResolver::dataDir()
{
}

void GroovesharkResolver::instanceStarted( KDSingleApplicationGuard::Instance )
{
}

void GroovesharkResolver::playdarMessage( const QVariant& )
{
}

void GroovesharkResolver::sendSettingsMessage()
{
}

void GroovesharkResolver::loadSettings()
{
}

void GroovesharkResolver::saveSettings() const
{
}
