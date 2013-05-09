project(tomahawkspotify)

SET(ZLIB_LIBRARY "/usr/lib/libz.a")

cmake_minimum_required(VERSION 2.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)
find_package(Boost REQUIRED)

add_subdirectory(qxtweb-standalone)

IF( WITH_BREAKPAD )  
    add_subdirectory(breakpad)    
ENDIF()

include_directories( qxtweb-standalone/qxtweb kdsingleapplicationguard/ breakpad/ ${QT_INCLUDES} ${LIBSPOTIFY_INCLUDE_DIR} ${QJSON_INCLUDE_DIR} ${CMAKE_CURRENT_BINARY_DIR} ${Boost_INCLUDE_DIRS})

# Static helpers :)
SET(CMAKE_C_FLAGS "-pthread -static-libgcc ${CMAKE_C_FLAGS}")
SET(CMAKE_CXX_FLAGS "-Wl,--dynamic-linker=/lib64/ld-linux-x86-64.so.2 -Wl,--no-undefined -static-libgcc -L. -lspotify ${CMAKE_CXX_FLAGS} -pthread")

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

IF( WITH_BREAKPAD )  
    message(STATUS "Build with support for breakpad.")
    if( APPLE )
        FIND_LIBRARY( COREFOUNDATION_LIBRARY CoreFoundation )

    ENDIF( APPLE )
    LIST( APPEND tomahawkspotify_SRCS BreakPad.cpp )
ENDIF()



IF(WITH_BREAKPAD)
    SET( BREAKPAD_LIBRARIES tomahawk_breakpad )
ENDIF()

add_executable(spotify_tomahawkresolver ${tomahawkspotify_SRCS} ${RC_SRCS} ${tomahawkspotify_NOMOC_HDRS} )
target_link_libraries(spotify_tomahawkresolver qxtweb-standalone ${QT_QTNETWORK_LIBRARY} ${QT_QTCORE_LIBRARY} ${QJSON_LIBRARIES} ${COREFOUNDATION_LIBRARY} ${BREAKPAD_LIBRARIES})

SET_TARGET_PROPERTIES(spotify_tomahawkresolver PROPERTIES AUTOMOC TRUE)

if("${CMAKE_VERSION}" STREQUAL "2.8.5" OR "${CMAKE_VERSION}" STRGREATER "2.8.5")
    include(GNUInstallDirs)
elseif(NOT CMAKE_INSTALL_LIBEXECDIR)
    set(CMAKE_INSTALL_LIBEXECDIR "libexec")
endif()

install(TARGETS spotify_tomahawkresolver RUNTIME DESTINATION ${CMAKE_INSTALL_LIBEXECDIR})
