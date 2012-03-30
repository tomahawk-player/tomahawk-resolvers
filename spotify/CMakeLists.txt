project(tomahawkspotify)
cmake_minimum_required(VERSION 2.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)
find_package(Boost)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++0x -fpermissive")

add_subdirectory(qxtweb-standalone)

include_directories( qxtweb-standalone/qxtweb kdsingleapplicationguard/ ${QT_INCLUDES} ${LIBSPOTIFY_INCLUDE_DIR} ${QJSON_INCLUDE_DIR} ${CMAKE_CURRENT_BINARY_DIR})

set(tomahawkspotify_SRCS

    kdsingleapplicationguard/kdsingleapplicationguard.cpp
    kdsingleapplicationguard/kdsharedmemorylocker.cpp
    kdsingleapplicationguard/kdtoolsglobal.cpp
    kdsingleapplicationguard/kdlockedsharedmemorypointer.cpp
    PlaylistClosure.cpp
    spotifyloghandler.cpp
    spotifyplayback.cpp
    spotifysearch.cpp
    spotifyplaylists.cpp
    spotifysession.cpp
    spotifyresolver.cpp
    consolewatcher.cpp
    audiohttpserver.cpp
    spotifyiodevice.cpp
    main.cpp
)

set( tomahawkspotify_NOMOC_HDRS
    kdsingleapplicationguard/kdsharedmemorylocker.h
    kdsingleapplicationguard/kdtoolsglobal.h
    kdsingleapplicationguard/kdlockedsharedmemorypointer.h
)

set( tomahawkspotify_HDRS
    kdsingleapplicationguard/kdsingleapplicationguard.h
    PlaylistClosure.h
    spotifyloghandler.h
    spotifyplayback.h
    spotifysearch.h
    spotifyplaylists.h
    spotifysession.h
    spotifyresolver.h
    consolewatcher.h
    audiohttpserver.h
    spotifyiodevice.h
)

qt4_wrap_cpp( tomahawkspotify_MOC_HDRS ${tomahawkspotify_HDRS})

add_executable(spotify_tomahawkresolver ${tomahawkspotify_SRCS} ${RC_SRCS} ${tomahawkspotify_MOC_HDRS} ${tomahawkspotify_NOMOC_HDRS} )
target_link_libraries(spotify_tomahawkresolver qxtweb-standalone ${QT_QTCORE_LIBRARY} ${QT_QTGUI_LIBRARY} ${LIBSPOTIFY_LIBRARIES} ${QT_QTNETWORK_LIBRARY} ${QJSON_LIBRARIES})

if("${CMAKE_VERSION}" STREQUAL "2.8.5" OR "${CMAKE_VERSION}" STRGREATER "2.8.5")
    include(GNUInstallDirs)
elseif(NOT CMAKE_INSTALL_LIBEXECDIR)
    set(CMAKE_INSTALL_LIBEXECDIR "libexec")
endif()

install(TARGETS spotify_tomahawkresolver RUNTIME DESTINATION ${CMAKE_INSTALL_LIBEXECDIR})
