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

#ifndef SPOTIFYSEARCH_H
#define SPOTIFYSEARCH_H

#include <QObject>
#include <libspotify/api.h>

class SpotifySearch : public QObject
{
    Q_OBJECT
public:
    explicit SpotifySearch(QString query, QObject *parent = 0);
    static void SP_CALLCONV searchComplete( sp_search *result, void *userdata );
    static void SP_CALLCONV addSearchedTrack( sp_search *result, void *userdata );
    static void SP_CALLCONV albumSearchComplete( sp_search *result, void *userdata );

    static void SP_CALLCONV albumBrowseLoaded( sp_albumbrowse* album, void *userdata );
signals:
    
public slots:
    
};

#endif // SPOTIFYSEARCH_H
