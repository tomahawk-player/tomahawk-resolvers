#include <QCoreApplication>

#include "spotifyresolver.h"

// Copyright Leo Franchi <lfranchi@kde.org> 2011
//
// Parts of the spotify-facing code inspired from Spokify code, see quickgit.kde.org/spokify
//
// THIS PROJECT AND ALL FILES HEREIN ARE LICENSED UNDER THE REVISED MIT LICENSE
// SEE COPYING FILE FOR MORE INFORMATION

int main(int argc, char** argv)
{
    SpotifyResolver app( argc, argv );
    return app.exec();
}
