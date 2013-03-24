# Tomahawk Resolvers Developer Documentation

## Developing resolvers

The Tomahawk resolver API is currently still in flux. It is probably a good idea to use the existing resolvers as example.

The API you should develop against is defined in [`tomahawk.js`](https://github.com/tomahawk-player/tomahawk/blob/master/data/js/tomahawk.js) and [`QtScriptResolverHelper`](https://github.com/tomahawk-player/tomahawk/blob/master/src/libtomahawk/resolvers/QtScriptResolver.h) in the Tomahawk main repo.

If you have questions, look for us in #tomahawk on irc.freenode.net.

### Licensing

Tomahawk resolvers are considered derivative works of Tomahawk, specifically through the previously mentioned `tomahawk.js` and `QtScriptResolver.h` files. These files are released under a GNU General Public License, version 3 or later.

Thus, developers who release a resolver are expected to
* release the resolver code they produce under a license compatible with Tomahawk, and specifically with Tomahawk's resolver interface, and
* add a copyright and licensing statement at the beginning of those resolver file(s) that interface with Tomahawk, with a wording that makes their licensing (and compatibility) clear.

Exceptions to this requirement can be evaluated upon request by the Tomahawk team.

## Packaging resolvers

### Structure overview

Starting with Tomahawk 0.7, all resolver directories must be structured as follows.

Mandatory:
```
content/
  + metadata.json
```
Suggested:
```
content/
  + metadata.json
  + contents/
    + code/
      + <resolver script>.js
      + config.ui
      + <everything else>
    + images/
      + icon.png
```

This structure is commonly referred to as a resolver bundle, i.e. a resolver script with all related files and metadata.

A bundle can be packaged or unpackaged (i.e. as it is in this repo), thus resolvers can be installed manually in two ways:
* from an unpackaged bundle,
* from a package (or axe).

### Installing a resolver bundle

To install a resolver from an unpackaged bundle (the preferred way for testing and development), in Tomahawk's Settings dialog click on "Install from file" and select the resolver's main .js file.

Keep in mind that with such a path, Tomahawk expects to find the file `metadata.json` in `../..` from the main script's path. If `metadata.json` is not found, it is likely that your resolver directory is not structured properly. The resolver's main script will still be loaded, but any additional scripts will not and the accounts list in the Settings dialog will not show any metadata for the resolver (e.g. author, version, etc.). This is a **bad thing**. The only reason why a resolver without `metadata.json` is still loaded is backward compatibility. Plain unbundled .js files as resolvers are deprecated. You should update your resolver to a proper bundle structure as soon as possible.

A packaged resolver bundle is a file with file extension `axe`. It is a compressed archive with all the contents of a resolver directory. To install such a bundle (the preferred way for end users who wish to install a resolver manually), in Tomahawk's Settings dialog click on "Install from file" and select the package file (`<something>.axe`).

**WARNING** for developers and testers: the installation process for an *unpackaged* bundle loads the resolver in-place. This means that any changed to the resolver script are applied immediately, simply by disabling and re-enabling the "installed" resolver with the account's checkbox in the accounts list. There is usually no need to remove and re-install the resolver. This also means that changes to the directory structure may make the resolver stop functioning. On the other hand, packaged bundles (axes) are decompressed and copied to a Tomahawk-managed directory (`<local user data dir>/manualresolvers`) during the installation process, so any change to the axe can only be applied by re-installing.

### Packaging

#### metadata.json

Every resolver bundle directory must contain a metadata file. This file must be named `metadata.json`, and it must be located in the directory `content` relative to the top-level resolver bundle directory.

For example, this is a `metadata.json` file for Subsonic:
```
{
    "name": "Subsonic",
    "pluginName": "subsonic",
    "author": "mack_t and Teo",
    "email": "teo@kde.org",
    "version": "0.5",
    "website": "http://gettomahawk.com",
    "description": "Searches your Subsonic server for music to play",
    "type": "resolver/javascript",
    "manifest": {
        "main": "contents/code/subsonic.js",
        "scripts": [],
        "icon": "contents/images/icon.png",
        "resources": [
            "contents/code/config.ui",
            "contents/code/runnersid-icon.png",
            "contents/code/subsonic-icon.png",
            "contents/code/subsonic.png"
        ]
    }
}
```

For most purposes all the fields are mandatory.

**WARNING**: the manifest object **must** list all the files required by the resolver. Unlisted scripts will not be loaded, and any unlisted files will not be packaged.

#### makeaxe.rb

If your resolver directory conforms to the previously described structure and your `metadata.json` is complete, the harder part is done. The Tomahawk team provides you with a script to automate the packaging process: [`makeaxe.rb`](admin/makeaxe.rb). You will need [ruby](http://www.ruby-lang.org/en/) 1.9.2 or later and the [zip](https://rubygems.org/gems/zip) gem.

To create a package from a resolver directory, simply run `makeaxe.rb` with the directory path passed as parameter.

E.g. on Linux and Mac OS X, for Subsonic and from the repository root, you would do the following:
```
% ruby admin/makeaxe.rb subsonic
% ls subsonic
content/  subsonic-0.5.axe  subsonic-0.5.md5
```
In this case, `subsonic-0.5.axe` is the compressed bundle and `subsonic-0.5.md5` is the MD5 checksum file.

Please note that `makeaxe.rb` does not simply compress the contents of the directory, it also checks the metadata file and adds additional data, including a packaging timestamp and the revision hash, if any.

Optionally, if you pass the `--release` parameter to `makeaxe.rb` it will not include the commit hash in the axe, as would be expected in a release-worthy package.

Happy packaging!
