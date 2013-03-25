project(tomahawkspotify)
cmake_minimum_required(VERSION 2.8.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)

find_package(Boost REQUIRED)

add_subdirectory(qxtweb-standalone)

include_directories( qxtweb-standalone/qxtweb kdsingleapplicationguard/
                                              ${QT_INCLUDES}
                                              ${LIBSPOTIFY_INCLUDE_DIR}
                                              ${QJSON_INCLUDE_DIR}
                                              ${Boost_INCLUDE_DIRS}
                                              ${CMAKE_CURRENT_BINARY_DIR})

if(NOT EXISTS "${CMAKE_BINARY_DIR}/spotify-sourceicon.png")
    message("Copying spotify source icon to binary dir")
    file(COPY "${CMAKE_SOURCE_DIR}/spotify-sourceicon.png" DESTINATION ${CMAKE_BINARY_DIR})
else()
    message("Found existing spotify source icon, not copying")
endif()

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


add_executable(spotify_tomahawkresolver ${tomahawkspotify_SRCS} ${RC_SRCS} ${tomahawkspotify_NOMOC_HDRS} )
target_link_libraries(spotify_tomahawkresolver qxtweb-standalone ${QT_QTCORE_LIBRARY} ${LIBSPOTIFY_LIBRARIES} ${QT_QTNETWORK_LIBRARY} ${QJSON_LIBRARIES})

SET_TARGET_PROPERTIES(spotify_tomahawkresolver PROPERTIES AUTOMOC TRUE)

include(GNUInstallDirs)
install(TARGETS spotify_tomahawkresolver RUNTIME DESTINATION ${CMAKE_INSTALL_LIBEXECDIR})
