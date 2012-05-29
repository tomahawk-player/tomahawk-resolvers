project(tomahawkspotify)
cmake_minimum_required(VERSION 2.8.6)

SET(ZLIB_LIBRARY "/usr/lib/libz.a")

add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)
find_package(Boost)

add_subdirectory(qxtweb-standalone)

include_directories( qxtweb-standalone/qxtweb kdsingleapplicationguard/ ${QT_INCLUDES} ${LIBSPOTIFY_INCLUDE_DIR} ${QJSON_INCLUDE_DIR} ${CMAKE_CURRENT_BINARY_DIR} ${Boost_INCLUDE_DIRS})

# Static helpers :)
SET(CMAKE_C_FLAGS "-pthread -static-libgcc -static-libstdc++ ${CMAKE_C_FLAGS}")
SET(CMAKE_CXX_FLAGS "-Wl,--dynamic-linker=/lib64/ld-linux-x86-64.so.2 -Wl,--no-undefined -static-libgcc -static-libstdc++ -L. -lspotify ${CMAKE_CXX_FLAGS} -pthread")

SET(CMAKE_SKIP_BUILD_RPATH FALSE)
SET(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
SET(CMAKE_INSTALL_RPATH ".")
SET(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

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
target_link_libraries(spotify_tomahawkresolver qxtweb-standalone ${QT_QTNETWORK_LIBRARY} ${QT_QTCORE_LIBRARY} ${QJSON_LIBRARIES})

SET_TARGET_PROPERTIES(spotify_tomahawkresolver PROPERTIES AUTOMOC TRUE)

include(GNUInstallDirs)
install(TARGETS spotify_tomahawkresolver RUNTIME DESTINATION ${CMAKE_INSTALL_LIBEXECDIR})
