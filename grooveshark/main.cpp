#include <QCoreApplication>

#include "groovesharkresolver.h"

// Copyright Leo Franchi <lfranchi@kde.org> 2011
//
// THIS PROJECT AND ALL FILES HEREIN ARE LICENSED UNDER THE REVISED MIT LICENSE
// SEE COPYING FILE FOR MORE INFORMATION

#include "kdsingleapplicationguard/kdsingleapplicationguard.h"

int main(int argc, char** argv)
{
    GroovesharkResolver app( argc, argv );
    KDSingleApplicationGuard guard( &app, KDSingleApplicationGuard::NoPolicy );
    QObject::connect( &guard, SIGNAL( instanceStarted( KDSingleApplicationGuard::Instance ) ), &app, SLOT( instanceStarted( KDSingleApplicationGuard::Instance )  ) );
    app.init();

    return app.exec();
}
