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
# This script converts a json metadata/manifest file into a desktop file for Synchrotron.
#

require 'json'

if ARGV.length < 1
    puts "This script converts a Tomahawk resolver's metadata/manifest JSON file"
    puts "into a desktop file for Synchrotron."
    puts "\nMake sure you have the gems json and zipruby."
    puts "Usage: ruby json2desktop.rb path_to_metadata_file.json"
    exit
end

inputPath = File.absolute_path( ARGV[0] )
outputPath = File.join( File.dirname( inputPath ), "metadata.desktop" )

if not File.exists?( inputPath ) or not File.readable?( inputPath )
    puts "Cannot read input file."
    exit
end

if File.exists?( outputPath ) and not File.writable?( outputPath )
    puts "Cannot write to output file."
    exit
end

inputFile = File.open( inputPath, 'r' )
inputString = inputFile.read
input = JSON.parse( inputString )
inputFile.close unless inputFile == nil

# check if outputPath exists, maybe save stuff and/or overwrite, yes?
File.open( outputPath, 'w' ) do |f|
    f.write "\
############################################################################
## Desktop file generated from JSON file '#{File.basename( inputPath )}' 
##
## Created: #{Time.now.to_s}
##      by: json2desktop.rb, https://github.com/tomahawk-player
##
##                         #### WARNING! ####
##              All changes made to this file will be lost!
############################################################################

[Desktop Entry]\n"

    unless input["name"].nil? || input["name"].empty?
        f.write "Name=#{input["name"]}\n"
    end

    unless input["description"].nil? || input["description"].empty?
        f.write "Comment=#{input["description"]}\n"
    end
    
    f.write "\nType=Service\nX-KDE-ServiceTypes=Tomahawk/Resolver\n"
    
    unless input["manifest"].nil?
        unless input["manifest"]["main"].nil? || input["manifest"]["main"].empty?
            f.write "X-Synchrotron-MainScript=#{input["manifest"]["main"]}\n"
        end
    end
    
    f.write "\n"
    
    unless input["pluginName"].nil? || input["pluginName"].empty?
        f.write "X-KDE-PluginInfo-Name=#{input["pluginName"]}\n"
    end
    
    f.write "X-KDE-PluginInfo-Category=Resolver\n"

    unless input["author"].nil? || input["author"].empty?
        f.write "X-KDE-PluginInfo-Author=#{input["author"]}\n"
    end

    unless input["email"].nil? || input["email"].empty?
        f.write "X-KDE-PluginInfo-Email=#{input["email"]}\n"
    end

    unless input["version"].nil? || input["version"].empty?
        f.write "X-KDE-PluginInfo-Version=#{input["version"]}\n"
    end

    unless input["website"].nil? || input["website"].empty?
        f.write "X-KDE-PluginInfo-Website=#{input["website"]}\n"
    end
end
