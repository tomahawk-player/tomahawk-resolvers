#!/usr/bin/env ruby
#
#   This takes a spotify_tomahawkresolver binary for osx, and a pre-built Tomahawk.app bundle, and creates
#    the signed zip file + manifest suitable for uploading to Synchrotron
#
#  Note that this assumes the Tomahawk.app bundle contains libspotify and qjson.
#

QT_VERSION = "4.8.0"
LIBSPOTIFY_VERSION = "11.1.60"
QJSON_VERSION = "0.7.1"

if ARGV.length < 3
  puts "Usage: ruby create_synchrotron.rb spotify_tomahawkresolver Tomahawk.app/ private_key_file"
  puts "\nCall this from the build directory."
  puts "If you don't have the tomahawk private key and you think you should, ask leo :)"
  exit
end

if not File.exists?(ARGV[0]) or not File.directory?(ARGV[1]) or not File.exists?(ARGV[2])
  puts "One of your arguments didn't exist!"
  exit
end

# Manually install_name_tool the spotify binary to point to relative paths in the Tomahawk.app bundle
# This assumes the resolver will be in the Tomahawk.app/Contents/MacOS folder
`install_name_tool -change /usr/local/Cellar/qt/#{QT_VERSION}/lib/QtCore.framework/Versions/4/QtCore @executable_path/../Frameworks/QtCore.framework/Versions/4/QtCore spotify_tomahawkresolver`
`install_name_tool -change /usr/local/Cellar/qt/#{QT_VERSION}/lib/QtNetwork.framework/Versions/4/QtNetwork @executable_path/../Frameworks/QtNetwork.framework/Versions/4/QtNetwork spotify_tomahawkresolver`
`install_name_tool -change /usr/local/lib/libqjson.#{QJSON_VERSION}.dylib @executable_path/../Frameworks/libqjson.#{QJSON_VERSION}.dylib spotify_tomahawkresolver`
`install_name_tool -change /usr/local/lib/libspotify.#{LIBSPOTIFY_VERSION}.dylib @executable_path/../Frameworks/libspotify.#{LIBSPOTIFY_VERSION}.dylib spotify_tomahawkresolver`

`mkdir spotify`
`cp #{ARGV[0]} spotify/`
`zip -r spotify_osx.zip spotify/`
