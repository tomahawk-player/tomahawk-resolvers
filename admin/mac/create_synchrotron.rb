#!/usr/bin/env ruby
#
#   This takes a binary for osx and creates
#    the signed zip file + manifest suitable for uploading to Synchrotron
#
#  Note that this assumes the Tomahawk.app bundle contains libspotify and qjson.
#
require 'pathname'

QT_VERSION = "4.8.0"
LIBSPOTIFY_VERSION = "#{`brew ls -version libspotify | tr -s " " "\012" | tail -n 1`}".strip
QJSON_VERSION = "0.7.1"

puts "LIBS version: #{LIBSPOTIFY_VERSION}"
if ARGV.length < 4
  puts "Usage: ruby create_synchrotron.rb spotify_tomahawkresolver metadata.desktop private_key_file /path/to/tomahawk-synchrotron"
  puts "\n"
  puts "If you don't have the tomahawk private key and you think you should, ask leo :)"
  exit
end

if not File.exists?(ARGV[0]) or not File.exists?(ARGV[1]) or not File.exists?(ARGV[2]) or not File.directory?(ARGV[3])
  puts "One of your arguments didn't exist!"
  exit
end

resolver = Pathname.new(ARGV[0]).basename.to_s
resolvername = resolver.split("_")[0]
platform = "osx"
  

puts "Creating zipfile for #{resolver}..."

`cp #{ARGV[0]} #{resolver}`
# Manually install_name_tool the spotify binary to point to relative paths in the Tomahawk.app bundle
# This assumes the resolver will be in the Tomahawk.app/Contents/MacOS folder
`install_name_tool -change /usr/local/Cellar/qt/#{QT_VERSION}/lib/QtCore.framework/Versions/4/QtCore @executable_path/../Frameworks/QtCore.framework/Versions/4/QtCore #{resolver}`
`install_name_tool -change /usr/local/Cellar/qt/#{QT_VERSION}/lib/QtNetwork.framework/Versions/4/QtNetwork @executable_path/../Frameworks/QtNetwork.framework/Versions/4/QtNetwork #{resolver}`
`install_name_tool -change /usr/local/lib/QtCore.framework/Versions/4/QtCore @executable_path/../Frameworks/QtCore.framework/Versions/4/QtCore #{resolver}`
`install_name_tool -change /usr/local/lib/QtNetwork.framework/Versions/4/QtNetwork @executable_path/../Frameworks/QtNetwork.framework/Versions/4/QtNetwork #{resolver}`
`install_name_tool -change /usr/local/lib/libqjson.#{QJSON_VERSION}.dylib @executable_path/../Frameworks/libqjson.#{QJSON_VERSION}.dylib #{resolver}`
`install_name_tool -change /usr/local/lib/libspotify.#{LIBSPOTIFY_VERSION}.dylib @executable_path/libspotify.#{LIBSPOTIFY_VERSION}.dylib #{resolver}`

LIBSPOTIFY_LOCAL = "libspotify.#{LIBSPOTIFY_VERSION}.dylib"
`cp /usr/local/lib/libspotify.#{LIBSPOTIFY_VERSION}.dylib #{LIBSPOTIFY_LOCAL}`
`chmod +rw #{LIBSPOTIFY_LOCAL}`
tarball = "#{resolvername}-#{platform}.zip"
`zip -r #{tarball} #{resolver} #{LIBSPOTIFY_LOCAL}`
`rm #{resolver}`
`rm #{LIBSPOTIFY_LOCAL}`

puts "Signing..."
signature = `openssl dgst -sha1 -binary < "#{tarball}" | openssl dgst -dss1 -sign "#{ARGV[2]}" | openssl enc -base64`
puts "Signature: #{signature}"

fd = File.open(ARGV[1], 'r')
manifest = fd.read

manifest["_SIGNATURE_"] = signature
manifest["_ZIPFILE_"] = tarball
manifest["_PLATFORM_"] = platform
manifest["_TYPE_"] = platform
manifest["_BINARY_"] = resolver



resolverDir = "#{ARGV[3]}/resolvers/#{resolvername}-#{platform}/content"
`mkdir -p #{resolverDir}` if not File.directory?(resolverDir)

File.open("#{resolverDir}/metadata.desktop", "w") do |f|
  f.write(manifest)
end

`mv #{tarball} #{resolverDir}`
