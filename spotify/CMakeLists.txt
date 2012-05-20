project(tomahawkspotify)
cmake_minimum_required(VERSION 2.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)

find_package(Boost)

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


add_executable(spotify_tomahawkresolver ${tomahawkspotify_SRCS} ${RC_SRCS} ${tomahawkspotify_NOMOC_HDRS} )
target_link_libraries(spotify_tomahawkresolver qxtweb-standalone ${QT_QTCORE_LIBRARY} ${LIBSPOTIFY_LIBRARIES} ${QT_QTNETWORK_LIBRARY} ${QJSON_LIBRARIES})

SET_TARGET_PROPERTIES(spotify_tomahawkresolver PROPERTIES AUTOMOC TRUE)

if("${CMAKE_VERSION}" STREQUAL "2.8.5" OR "${CMAKE_VERSION}" STRGREATER "2.8.5")
    include(GNUInstallDirs)
elseif(NOT CMAKE_INSTALL_LIBEXECDIR)
    set(CMAKE_INSTALL_LIBEXECDIR "libexec")
endif()

install(TARGETS spotify_tomahawkresolver RUNTIME DESTINATION ${CMAKE_INSTALL_LIBEXECDIR})
