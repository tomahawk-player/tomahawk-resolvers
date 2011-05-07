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

#ifndef CALLBACKS_H
#define CALLBACKS_H

#include "spotifyresolver.h"

#include <libspotify/api.h>

#include <QString>
#include <QDebug>
#include "audiohttpserver.h"
#include <qstringlist.h>

struct AudioData {
    void* data;
    int numFrames;
    int sampleRate;
};

namespace SpotifyCallbacks {

static void loggedIn(sp_session *session, sp_error error)
{
    Q_UNUSED(session);

    if (error == SP_ERROR_OK) {
        qDebug() << "Logged in successfully!!";
        sApp->setLoggedIn( true );
        return;
    }

    switch (error) {
        case SP_ERROR_BAD_API_VERSION:
        case SP_ERROR_API_INITIALIZATION_FAILED:
        case SP_ERROR_RESOURCE_NOT_LOADED:
        case SP_ERROR_BAD_APPLICATION_KEY:
        case SP_ERROR_CLIENT_TOO_OLD:
        case SP_ERROR_BAD_USER_AGENT:
        case SP_ERROR_MISSING_CALLBACK:
        case SP_ERROR_INVALID_INDATA:
        case SP_ERROR_INDEX_OUT_OF_RANGE:
        case SP_ERROR_OTHER_TRANSIENT:
        case SP_ERROR_IS_LOADING:
            qDebug() << QString("An internal error happened with error code (%1).\n\nPlease, report this bug." ).arg(error);
            break;
        case SP_ERROR_BAD_USERNAME_OR_PASSWORD:
            qDebug() << "Invalid username or password";
            break;
        case SP_ERROR_USER_BANNED:
            qDebug() << "This user has been banned";
            break;
        case SP_ERROR_UNABLE_TO_CONTACT_SERVER:
            qDebug() << "Cannot connect to server";
            break;
        case SP_ERROR_OTHER_PERMANENT:
            qDebug() << "Something wrong happened.\n\nWhatever it is, it is permanent.";
            break;
        case SP_ERROR_USER_NEEDS_PREMIUM:
            qDebug() << "You need to be a Premium User in order to login";
            break;
        default:
            qDebug() << "Some other error... wtf?" << sp_error_message( error );
            break;
    }
}

static void loggedOut(sp_session *session)
{
    Q_UNUSED(session);
//     MainWindow::self()->spotifyLoggedOut();
}

static void metadataUpdated(sp_session *session)
{
    Q_UNUSED(session);
//     MainWindow::self()->fillPlaylistModel();
}

static void connectionError(sp_session *session, sp_error error)
{
    Q_UNUSED(session);
    Q_UNUSED(error);
}

static void messageToUser(sp_session *session, const char *message)
{
    Q_UNUSED(session);
    Q_UNUSED(message);
}

static void notifyMainThread(sp_session *session)
{
    Q_UNUSED(session);
    sApp->sendNotifyThreadSignal();
}

static int musicDelivery(sp_session *session, const sp_audioformat *format, const void *frames, int numFrames_)
{
    Q_UNUSED(session);

    if (!numFrames_) {
        return 0;
    }

    const int numFrames = qMin(numFrames_, 8192);

//     qDebug() << "gots me some data:" << numFrames_;
    QMutex &m = sApp->dataMutex();
    m.lock();
    AudioData d;
    d.data = malloc( numFrames * sizeof(int16_t) * format->channels );
    memcpy( d.data, frames, numFrames * sizeof(int16_t) * format->channels );
    d.numFrames = numFrames;
    d.sampleRate = format->sample_rate;
    sApp->queueData( d );
    m.unlock();
//     sApp->dataWaitCond().wakeAll();

    return numFrames;
}

static void playTokenLost(sp_session *session)
{
    Q_UNUSED(session);
//     MainWindow::self()->spotifyPlayTokenLost();
}

static void logMessage(sp_session *session, const char *data)
{
    Q_UNUSED(session);
    Q_UNUSED(data);
}

static void endOfTrack(sp_session *session)
{
    Q_UNUSED(session);
    qDebug() << "Got spotify end of track callback!";
    sApp->endOfTrack();

}

static void streamingError(sp_session *session, sp_error error)
{
    Q_UNUSED(session);
    Q_UNUSED(error);
}

static void userinfoUpdated(sp_session *session)
{
    Q_UNUSED(session);
}

#if SPOTIFY_API_VERSION > 4
static void startPlayback(sp_session *session)
{
    Q_UNUSED(session);
}

static void stopPlayback(sp_session *session)
{
    Q_UNUSED(session);
}

static void getAudioBufferStats(sp_session *session, sp_audio_buffer_stats *stats)
{
    Q_UNUSED(session);
    Q_UNUSED(stats);
}
#endif

static void searchComplete( sp_search *result, void *userdata )
{
    QString *data = static_cast<QString*>(userdata);
    QStringList parts = data->split( "~~~" );
    QString qid = parts.at( 1 );
//     qDebug() << "Got search result for:" << parts.at(0) << "and qid:" << parts.at(1);

    // we return the top 25 results
    QVariantMap resp;
    resp[ "qid" ] = qid;
    resp[ "_msgtype" ] = "results";
    QVariantList results;

    // TODO search by popularity!
//     qDebug() << "Got num results:" << sp_search_num_tracks( result );
    if( sp_search_num_tracks( result ) > 0 ) {// we have a result
        int num = qMin( sp_search_num_tracks( result ), 25 );
        for( int i = 0; i < num; i++ ) {
            sp_track *const tr = sp_search_track( result, i );
            if( !tr || !sp_track_is_loaded( tr ) ) {
                qDebug() << "Got still loading track, skipping";
                continue;
            }

            sp_link* link  = sp_link_create_from_track( tr, 0 );
            QString uid = sApp->addToTrackLinkMap( link );

            int duration = sp_track_duration( tr ) / 1000;
            QVariantMap track;
            track[ "track" ] = QString::fromUtf8( sp_track_name( tr ) );
            track[ "artist" ] = QString::fromUtf8( sp_artist_name( sp_track_artist( tr, 0 ) ) );
            track[ "album" ] = QString::fromUtf8( sp_album_name( sp_track_album( tr ) ) );
            track[ "mimetype" ] = "audio/basic";
            track[ "source" ] = "Spotify";
            track[ "url" ] = sApp->handler()->urlForID( uid );
            track[ "duration" ] = duration;
            track[ "score" ] = .95; // TODO
            track[ "bitrate" ] = 192; // TODO
            results << track;

            qDebug() << "Found Track:" << sp_track_name( tr ) << sp_track_artist( tr, 0 ) << sp_track_album( tr ) << sp_track_popularity( tr ) << "\n\tReporting:" << track["url"];
        }

    }
    resp[ "results" ] = results;

    sp_search_release( result );

    sApp->sendMessage( resp );

    delete data;
}

}

#endif