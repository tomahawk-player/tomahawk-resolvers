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

#include "spotifysearch.h"
#include "spotifysession.h"
#include "spotifyresolver.h"
#include <QDebug>

void
SpotifySearch::searchComplete( sp_search *result, void *userdata )
{
    UserData* data = reinterpret_cast<UserData*>( userdata );
    qDebug() << "Got search result for qid:" << data->qid;

    // we return the top 50 results for searches, just top 1 for resolve
    QVariantMap resp;
    resp[ "qid" ] = data->qid;
    resp[ "_msgtype" ] = "results";
    QVariantList results;

    // TODO search by popularity!
    qDebug() << "Got num results:" << sp_search_num_tracks( result );
    if( sp_search_num_tracks( result ) > 0 ) {// we have a result
        int num = qMin( sp_search_num_tracks( result ), data->fulltext ? 50 : 1 );
        for( int i = 0; i < num; i++ ) {
            sp_track *const tr = sp_search_track( result, i );
            if( !tr || !sp_track_is_loaded( tr ) ) {
                qDebug() << "Got still loading track, skipping";
                continue;
            }

            sp_link* link  = sp_link_create_from_track( tr, 0 );
            QString uid = data->resolver->addToTrackLinkMap( link );

            int duration = sp_track_duration( tr ) / 1000;
            QVariantMap track;
            track[ "track" ] = QString::fromUtf8( sp_track_name( tr ) );
            track[ "artist" ] = QString::fromUtf8( sp_artist_name( sp_track_artist( tr, 0 ) ) );
            track[ "album" ] = QString::fromUtf8( sp_album_name( sp_track_album( tr ) ) );
            track[ "albumpos" ] = sp_track_index( tr );
            track[ "discnumber"] = sp_track_disc( tr );
            track[ "year" ] = sp_album_year( sp_track_album( tr ) );
            track[ "mimetype" ] = "audio/basic";
            track[ "source" ] = "Spotify";
            track[ "url" ] = QString( "http://localhost:%1/sid/%2.wav" ).arg( data->resolver->port() ).arg( uid );
            track[ "duration" ] = duration;
            track[ "score" ] = .95; // TODO
            track[ "bitrate" ] = 192; // TODO

            // 8 is "magic" number. we don't know how much spotify compresses or in which format (mp3 or ogg) from their server, but 1/8th is approximately how ogg -q6 behaves, so use that for better displaying
            quint32 bytes = ( duration * 44100 * 2 * 2 ) / 8;
            track[ "size" ] = bytes;
            results << track;

            //qDebug() << "Found Track:" << sp_track_name( tr ) << "\n\tReporting:" << track["url"];
        }

    }
    resp[ "results" ] = results;
    sp_search_release( result );
    data->resolver->sendMessage( resp );
}

