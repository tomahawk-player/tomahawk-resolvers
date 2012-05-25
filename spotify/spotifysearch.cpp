/*
    Copyright (c) 2011 Leo Franchi <leo@kdab.com>
    Copyright (c) 2011 Hugo Lindström <hugolm84@gmail.com>
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
#include "spotifyplaylists.h"
#include "PlaylistClosure.h"

#include <QDebug>
#include <boost/bind.hpp>
class SpotifyPlaylists;
/**
  addSearchedTrack
  callback from sp_search_create
  will try and add track to spotify playlist passed in
  serachData ( userdata )
  **/
void
SpotifySearch::addSearchedTrack( sp_search *result, void *userdata)
{
    SpotifyPlaylists::AddTracksData *data = reinterpret_cast<SpotifyPlaylists::AddTracksData*>(userdata);

    if( sp_search_num_tracks( result ) < 1 )
    {
        const int pos = data->searchOrder.indexOf( result );
        qWarning() << "Got no search result for track we tried to add! Ignoring it... index is:" << pos;
        data->finaltracks[ pos ] = 0;
        data->waitingFor--;

        // Send error
        SpotifySession::getInstance()->doSendErrorMsg( QString("Can not add %1 to Spotify, not found in catalog.").arg( QString::fromUtf8(sp_search_query( result ) ) ), false );
    }
    else
    {
        int cur = 0;
        int max = sp_search_num_tracks(result);
        while( cur < max )
        {
            // Find a loaded track to add to the list
            sp_track *const tr = sp_search_track( result, cur );

//             qDebug() << "Got search result:" << result << sp_track_name( tr ) << sp_artist_name( sp_track_artist( tr, 0 ) );
            if( !tr ) {
                qDebug() << "Got an invalid search result, skipping";

                cur++;
                continue;
            }
            else if ( !sp_track_is_loaded( tr ) )
            {
                qDebug() << "Track in search results was not loaded!! Enqueueing to state changed callback!";
                QList< sp_track * > waitingForLoad = QList< sp_track* >() << tr;
                sApp->session()->Playlists()->addStateChangedCallback( NewPlaylistClosure( boost::bind( checkTracksAreLoaded, waitingForLoad ), sApp->session()->Playlists(), SLOT( addSearchedTrack( sp_search*, void* ) ), result, userdata ) );
                return;
            }

            const int pos = data->searchOrder.indexOf( result );
            qDebug() << "Adding track to playlist" << sp_track_name( tr ) << "at index:" << pos;
            data->finaltracks[ pos ] = tr;
            data->waitingFor--;
            break;
        }
    }

    if ( data->waitingFor == 0 )
    {
        // Got all the real tracks, now add
        qDebug() << "All added tracks were searched for, now inserting in playlist!";
        QList<int> tracksInserted;
        QList<QString> insertedIds;
        for ( int i = 0; i < data->finaltracks.size(); i++ )
        {
            if ( data->finaltracks[ i ] )
            {
                tracksInserted << i;

                sp_link* l = sp_link_create_from_track( data->finaltracks[i], 0 );
                char urlStr[256];
                sp_link_as_string( l, urlStr, sizeof(urlStr) );
                insertedIds << QString::fromUtf8( urlStr );
                sp_link_release( l );
            }
        }

        // Our vector may have "holes" in it, for any tracks that we couldn't find
        int count = 0;
        for ( QVector< sp_track* >::iterator iter = data->finaltracks.begin(); iter != data->finaltracks.end(); )
        {
            if ( !*iter )
            {
                qDebug() << "Removing not-found track from results, position:" << count;
                iter = data->finaltracks.erase( iter );
            } else
                ++iter;
            count++;
        }

        sApp->setIgnoreNextUpdate( true );
        sp_error err = sp_playlist_add_tracks(data->playlist, data->finaltracks.constBegin(), data->finaltracks.count(), data->pos, sApp->session()->Session());

        switch(err) {
            case SP_ERROR_OK:
                qDebug() << "Added tracks to pos" << data->pos;
                break;
            case SP_ERROR_INVALID_INDATA:
                qDebug() << "Invalid position";
                break;

            case SP_ERROR_PERMISSION_DENIED:
                qDebug() << "Access denied";
                break;
            default:
                qDebug() << "Other error (should not happen)";
                break;
        }

        sApp->sendAddTracksResult( data->plid, tracksInserted, insertedIds, err == SP_ERROR_OK );

        // Only free once
        delete data;
    }
}

/**
  searchComplete
  callback from sp_search
  **/
void
SpotifySearch::searchComplete( sp_search *result, void *userdata )
{
    UserData* data = reinterpret_cast<UserData*>( userdata );
    //qDebug() << "Got search result for qid:" << data->qid;

    // we return the top 50 results for searches, just top 1 for resolve
    QVariantMap resp;
    resp[ "qid" ] = data->qid;
    resp[ "_msgtype" ] = "results";
    QVariantList results;

    // TODO search by popularity!
    //qDebug() << "Got num results:" << sp_search_num_tracks( result );
    if( sp_search_num_tracks( result ) > 0 ) {// we have a result
        int num = qMin( sp_search_num_tracks( result ), data->fulltext ? 50 : 5 );
        for( int i = 0; i < num; i++ ) {
            // get playable track
            // note: if track is local, its added within the lib, and is playable
            sp_track *const tr = sp_track_get_playable( SpotifySession::getInstance()->Session(), sp_search_track( result, i ) );
            if( !tr || !sp_track_is_loaded( tr ) ) {
                qDebug() << "Got still loading track, skipping";
                continue;
            }

            sp_link* link  = sp_link_create_from_track( tr, 0 );
            QString uid = data->resolver->addToTrackLinkMap( link );
            sp_link_release( link );

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
            track[ "bitrate" ] = data->resolver->highQuality() ? 320 : 160; // TODO

            // 8 is "magic" number. we don't know how much spotify compresses or in which format (mp3 or ogg) from their server, but 1/8th is approximately how ogg -q6 behaves, so use that for better displaying
            quint32 bytes = ( duration * 44100 * 2 * 2 ) / 8;
            track[ "size" ] = bytes;
            results << track;
            data->searchCount = 0;
//            qDebug() << "Found Track:" << sp_track_name( tr ) << "\n\tReporting:" << track["url"];
        }

    }else
    {
        QString didYouMean = QString::fromUtf8(sp_search_did_you_mean(	result ) );
        QString queryString = QString::fromUtf8(sp_search_query(	result ) );
        if(data->searchCount <= 1 ){
            if( didYouMean.isEmpty() )
            {
                //qDebug() << "Tried DidYouMean, but no suggestions available for " << queryString;
            }
            else
            {
                //qDebug() << "Try nr." << data->searchCount << " Searched for" << queryString << "Did you mean?"<< didYouMean;
                //int distance = QString::compare(queryString, didYouMean, Qt::CaseInsensitive);
                //qDebug() << "Distance for query is " << distance;//if( distance < 4)
#if SPOTIFY_API_VERSION >= 11
                sp_search_create( SpotifySession::getInstance()->Session(), sp_search_did_you_mean(result), 0, data->fulltext ? 50 : 5, 0, 0, 0, 0, 0, 0, SP_SEARCH_STANDARD, &SpotifySearch::searchComplete, data );
#else
                sp_search_create( SpotifySession::getInstance()->Session(), sp_search_did_you_mean(result), 0, data->fulltext ? 50 : 5, 0, 0, 0, 0, &SpotifySearch::searchComplete, data );
#endif
            }
            data->searchCount++;
            return;
        }else
            qDebug() << "Tried to find suggestion to many times";


    }

    resp[ "results" ] = results;
    sp_search_release( result );
    data->resolver->sendMessage( resp );
    delete data;
}

