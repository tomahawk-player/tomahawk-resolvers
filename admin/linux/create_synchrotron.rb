#!/usr/bin/env ruby
#
#   This takes a binary for 32bit or 64bit linux
#    the signed zip file + manifest suitable for uploading to Synchrotron
#
#
require 'pathname'

LIBSPOTIFY_VERSION = "libspotify.so.11"

if ARGV.length < 6
  puts "Usage: ruby create_synchrotron.rb [x86|x64] /path/to/static/builddir resolvername_tomahawkresolver metadata.desktop private_key_file /path/to/tomahawk-synchrotron"
  puts "\n"
  puts "If you don't have the tomahawk private key and you think you should, ask leo :)"
  exit
end

fullPath = File.join(ARGV[1], ARGV[2])

if not File.directory?(ARGV[1]) or not File.exists?(fullPath) or not File.exists?(ARGV[3]) or not File.exists?(ARGV[4]) or not File.directory?(ARGV[5])
  puts "One of your arguments didn't exist!"
  exit
end

libspotify = File.join(ARGV[1], LIBSPOTIFY_VERSION)
resolver = ARGV[2].split("_")[0]
platform = "linux-#{ARGV[0]}"

puts "Creating zipfile for #{resolver} in folder #{fullPath}..."

folder = "#{resolver}-#{platform}"
`mkdir #{folder}`
`cp #{fullPath} #{folder}`
`cp #{libspotify} #{folder}`

tarball = "#{resolver}-#{platform}.zip"
`pushd #{folder} && zip -r "#{tarball}" * && mv "#{tarball}" .. && popd`
`rm -rf #{folder}`

signature = `openssl dgst -sha1 -binary < "#{tarball}" | openssl dgst -dss1 -sign "#{ARGV[4]}" | openssl enc -base64`
puts "Signature: #{signature}"

fd = File.open(ARGV[3], 'r')
manifest = fd.read

manifest["_SIGNATURE_"] = signature
manifest["_ZIPFILE_"] = tarball
manifest["_PLATFORM_"] = platform
manifest["_TYPE_"] = platform
manifest["_BINARY_"] = ARGV[2]

resolverDir = "#{ARGV[5]}/resolvers/#{resolver}-#{platform}/content"
`mkdir -p #{resolverDir}` if not File.directory?(resolverDir)

File.open("#{resolverDir}/metadata.desktop", "w") do |f|
  f.write(manifest)
end

`mv #{tarball} #{resolverDir}`
