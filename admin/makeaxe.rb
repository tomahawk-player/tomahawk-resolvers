#!/usr/bin/env ruby
# === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
#
#   Copyright 2013, Teo Mrnjavac <teo@kde.org>
#
#   Tomahawk is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   Tomahawk is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.


#
# This script reads a json metadata/manifest file and creates a Tomahawk
# resolver bundle (axe).
# The script should be executed with the top-level resolver directory path as
# parameter, and expects the following structure:
# Mandatory:
# content/
#   + metadata.json
# Suggested:
# content/
#   + metadata.json
#   + contents/
#     + code/
#       + <resolver script>.js
#       + config.ui
#       + <everything else>
#     + images/
#       + icon.png
#

require 'json'
require 'rubygems'
require 'zip/zip'
require 'digest/md5'

BUNDLEVERSION = 1 #might never be used but best to plan ahead

def usage
    puts "This script creates a Tomahawk resolver bundle."
    puts "\nMake sure you have the zip gem."
    puts "\nUsage: ruby makeaxe.rb path_to_resolver_directory [options]"
    puts " --release\tskip trying to add the git revision hash to the bundle"
    puts " --help\t\tthis help message"
end

if ARGV.length < 1 or not ARGV.delete( "--help" ).nil?
    usage
    exit
end

if not ARGV.delete( "--release" ).nil?
    release = true
else
    release = false
end

inputPath = File.absolute_path( ARGV[0] )

if not Dir.exists?( inputPath )
    puts "Bad input directory path."
    exit
end

metadataRelPath = "content/metadata.json"
metadataPath = File.join( inputPath, metadataRelPath )

if not File.exists?( metadataPath ) or not File.readable?( metadataPath )
    puts "Cannot find metadata file."
    puts "Make sure #{metadataRelPath} exists and is readable."
    exit
end

metadataFile = File.open( metadataPath, 'r' )
metadataString = metadataFile.read
metadata = JSON.parse( metadataString )
metadataFile.close unless metadataFile == nil

if not metadata["pluginName"].nil? and
   not metadata["name"].nil? and
   not metadata["version"].nil? and
   not metadata["description"].nil? and
   not metadata["type"].nil? and
   not metadata["manifest"].nil? and
   not metadata["manifest"]["main"].nil? and
   not metadata["manifest"]["icon"].nil?
    outputPath = File.join( inputPath, metadata["pluginName"] + "-" + metadata["version"] + ".axe" )
    puts "Bundle metadata looks ok."
else
    puts "Bad metadata file."
    exit
end

# Let's add some stuff to the metadata file, this is information that's much
# easier to fill in automatically now than manually whenever.
#   * Timestamp of right now i.e. packaging time.
#   * Git revision because it makes sense, especially during development.
#   * Bundle format version, which might never be used but we add it just in
#     case we ever need to distinguish one bundle format from another.
# We save it all as _metadata.json, which then gets added to the archive as
# metadata.json instead of the original one.
_metadataPath = File.join( inputPath, "content/_metadata.json" )
if not File.exists?( _metadataPath ) or File.writable?( _metadataPath )
    File.open( _metadataPath, 'w' ) do |f|
        metadata["timestamp"] = Time.now.utc.to_i
        
        unless release
            gitCmd = "git rev-parse --short HEAD 2>&1"
            inGit = system( gitCmd + "&>/dev/null" ) #will return true only if we're in a repo
            if inGit
                revision = %x[ #{gitCmd} ].sub( "\n", "" )
                metadata["revision"] = revision
            end
        end
        
        metadata["bundleVersion"] = BUNDLEVERSION
        
        f.write( JSON.pretty_generate( metadata ) )
    end
end

# Let's do some zipping according to the manifest.
filesToZip = []
begin
    m = metadata["manifest"]
    filesToZip << File.join( "content", m["main"] )
    m["scripts"].each do |s|
        filesToZip << File.join( "content", s )
    end
    filesToZip << File.join( "content", m["icon"] )
    m["resources"].each do |s|
        filesToZip << File.join( "content", s )
    end
end

puts "Creating package for #{metadata["name"]}: '#{File.basename( outputPath )}'."

if File.exists?( outputPath )
    File.delete( outputPath )
end

Zip::ZipFile.open( outputPath, Zip::ZipFile::CREATE ) do |z|
    filesToZip.each do |relPath|
        z.add( relPath, File.join( inputPath, relPath ) )
    end
    z.add( metadataRelPath, _metadataPath )
end

puts "Cleaning up."

File.delete( _metadataPath )
File.open( outputPath, 'r' ) do |f|
    File.open( outputPath.sub( "axe", "md5" ), 'w' ) do |g|
        g.write( Digest::MD5.hexdigest( f.read ).to_s + "\t" + File.basename( outputPath ) )
    end
end

puts "All done. Have a nice day."
