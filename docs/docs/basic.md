# Basic structure of a resolver

A resolver is made up of three parts: metadata, code and styling.
The styling of a resolver is mostly limited to an icon and the description of the UI for a possible login/settings screen.
Metadata like the name and version of the resolver is stored in a file called `metadata.json`.
The remaing (major) component is its code which will be used to connect a music service to Tomahawk's API.

These components are organized in the following directory structure:

```
<resolver>
 ↳ content
  ↳ metadata.json
  ↳ contents
    ↳ code
      ↳ resolver.js
      ↳ … .js
    ↳ images
      ↳ icon.png
```

## Metadata

In the metadata we describe the basic information of the resolver which needs to be accessible without invoking the resolver's code.
This includes the name and the icon shown to the user in the list of available plug-ins but also the information on which files need to be loaded to execute the code.

```javascript
{
	"name": "MusicService",
	"pluginName": "musicservice",
	"author": "Some Guy",
	"email": "author@example.com",
	"version": "9.9.9",
	"website": "http://gettomahawk.com",
	"description": "Returns example tracks for demonstation.",
	"type": "resolver/javascript",
	"manifest": {
		"main": "contents/code/resolver.js",
		"scripts": [],
		"icon": "contents/images/icon.png",
		"resources": [
			"contents/images/another-icon.png"
		]
	}
}
```

## Code
