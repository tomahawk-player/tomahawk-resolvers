project(grooveshark)
cmake_minimum_required(VERSION 2.6)
add_definitions(-fexceptions)
SET( CMAKE_MODULE_PATH "${CMAKE_MODULE_PATH}" "${CMAKE_SOURCE_DIR}/cmake/" )

find_package(Qt4 REQUIRED)
find_package(QJSON REQUIRED)

set(grooveshark_SRCS
 main.cpp
)

set( grooveshark_HDRS
)

qt4_wrap_cpp( grooveshark_MOC_HDRS ${grooveshark_HDRS})

#qt4_add_resources( RC_SRCS "resources.qrc" )
#add_executable(grooveshark_tomahawkresolver ${grooveshark_SRCS} # ${grooveshark_MOC_HDRS}
                #)
#target_link_libraries(grooveshark_tomahawkresolver ${QT_QTCORE_LIBRARY} ${QT_QTNETWORK_LIBRARY} ${QJSON_LIBRARIES})
