#!/usr/bin/env ruby
#
#   This takes a binary for windows and creates
#    the signed zip file + manifest suitable for uploading to Synchrotron
#
# This requires 7zip installed in C:\program files\7-Zip\7z.exe, and openssh installed as well.
#
# This will createa standalone zip file that bundles qt, libjqon, libqxtweb, and libspotify.
#  It expects a standalone spotify_tomahawkresolver.exe with the necessarily libs in the same folder
#
require 'pathname'

zipper = "C:\\Program Files\\7-Zip\\7z.exe"

if ARGV.length < 5
  puts "Usage: ruby create_synchrotron_win.rb /path/to/resolver_folder resolver_name.exe metadata.desktop private_key_file /path/to/tomahawk-synchrotron"
  puts "\nCall this from any directory."
  puts "If you don't have the tomahawk private key and you think you should, ask leo :)"
  exit
end

if not File.directory?(ARGV[0]) or not File.exists?(ARGV[2]) or not File.exists?(ARGV[3]) or not File.directory?(ARGV[4])
  puts "One of your arguments didn't exist!"
  exit
end

fullPath = File.join(ARGV[0], ARGV[1])
resolver = ARGV[1].split("_")[0]
platform = "win"
  
puts "Creating zipfile for #{resolver} in folder #{fullPath}..."

folder = "#{resolver}-#{platform}"
`mkdir #{folder}`
`copy #{ARGV[0]} #{folder}`

tarball = "#{resolver}-#{platform}.zip"
`pushd #{folder} && "#{zipper}" a -tzip "#{tarball}" * && move "#{tarball}" .. && popd`
`del /q #{folder}`
`rd #{folder}`

#puts "Signing... openssl dgst -sha1 -binary < \"#{tarball}\" | openssl dgst -dss1 -sign \"#{ARGV[3]}\" | openssl enc -base64"
signature = `openssl dgst -sha1 -binary < "#{tarball}" | openssl dgst -dss1 -sign "#{ARGV[3]}" | openssl enc -base64`
puts "Signature: #{signature}"

fd = File.open(ARGV[2], 'r')
manifest = fd.read

manifest["_SIGNATURE_"] = signature
manifest["_ZIPFILE_"] = tarball
manifest["_PLATFORM_"] = platform
manifest["_TYPE_"] = platform
manifest["_BINARY_"] = ARGV[1]

resolverDir = "#{ARGV[4]}\\resolvers\\#{resolver}-#{platform}\\content"
`mkdir #{resolverDir}` if not File.directory?(resolverDir)

File.open("#{resolverDir}/metadata.desktop", "w") do |f|
  f.write(manifest)
end

`move #{tarball} #{resolverDir}`
