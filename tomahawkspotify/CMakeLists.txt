project(tomahawkspotify)
cmake_minimum_required(VERSION 2.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)
find_package(libspotify REQUIRED)

add_subdirectory(qxtweb-standalone)

include_directories( qxtweb-standalone/qxtweb ${QT_INCLUDES} ${LIBSPOTIFY_INCLUDE_DIR} ${QJSON_INCLUDE_DIR} ${CMAKE_CURRENT_BINARY_DIR})

set(tomahawkspotify_SRCS spotifyresolver.cpp consolewatcher.cpp audiohttpserver.cpp spotifyiodevice.cpp main.cpp)
qt4_automoc(${tomahawkspotify_SRCS})
qt4_add_resources( RC_SRCS "resources.qrc" )
add_executable(tomahawkspotify ${tomahawkspotify_SRCS} ${RC_SRCS})
target_link_libraries(tomahawkspotify qxtweb-standalone ${QT_QTCORE_LIBRARY} ${LIBSPOTIFY_LIBRARIES} ${QT_QTNETWORK_LIBRARY} ${QJSON_LIBRARIES})
