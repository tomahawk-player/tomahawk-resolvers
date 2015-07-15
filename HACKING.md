# Tomahawk Resolvers Developer Documentation

## Developing resolvers

The best way to get you started with writing your own Resolver is by looking at the [`Example Resolver`](https://github.com/tomahawk-player/tomahawk-resolvers/tree/master/examples/javascript). It's well documented and includes almost every aspect of the Tomahawk Resolver API.

The API you should develop against is defined in [`tomahawk.js`](https://github.com/tomahawk-player/tomahawk/blob/master/data/js/tomahawk.js) and [`JSResolverHelper`](https://github.com/tomahawk-player/tomahawk/blob/master/src/libtomahawk/resolvers/JSResolverHelper.h) in the Tomahawk main repo. This API is also being used in the [`Tomahawk Android`](https://github.com/tomahawk-player/tomahawk-android) App. Furthermore we also have an implementation in [`NodeJS`](https://github.com/xhochy/node-tomahawkjs). This means that you only have to write one resolver and have it work right away on Desktop, Android and Node!

Since apiVersion 0.9 the resolver API has changed quite a bit.
Previously this was the way of returning results to Tomahawk in the "resolve"-function:
```javascript
resolve: function(qid, artist, album, track) {
    var results = getResultArray(artist, album, track);
    Tomahawk.addTrackResults(qid, results);
}
```
Now with the new promise-based API the same implementation would like this:  
```javascript
resolve: function (params) {
    return getResultArray(params.artist, params.album, params.track);
}
```
You can get the function parameters from the params map. Instead of relying on callback functions you are now able to return your results directly. Alternatively you can also return an RSVP.Promise object. But the real power of promises only becomes clear when you look at the way a "resolve"-request is normally being implemented in the real world:  
```javascript
resolve: function (params) {
    var q = params.artist + " " + params.track;
    return Tomahawk.get("http://someurl.org/search?q=" + q).then(function (result) {
        var results = parseResultArray(result);
        if (!results) {
            throw new Error("Sry, couldn't get results");
        } else {
            return results;
        }
    });
}
```
In one compact code block we are able to make a request. Then we parse the given "result" and simply return it without having to care about any request-id(qid) or callback-function. In addition we have a neat way of throwing an Error when something went wrong. Not to mention all the nice magic that comes with promise-functions like "all". If you're interested you might want to check out this great tutorial by Jake Archibald http://www.html5rocks.com/en/tutorials/es6/promises/. 

If you have questions, look for us in #tomahawk on irc.freenode.net.

### Licensing

Tomahawk resolvers are _not_ considered derivative works of Tomahawk. The resolver API is public, and resolvers could potentially be used without Tomahawk. The previously mentioned `tomahawk.js` file is non-copyleft open source, released under a permissive X11-style license.

Developers who create and release a resolver have no further obligation as far as licensing and distribution is concerned.

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
