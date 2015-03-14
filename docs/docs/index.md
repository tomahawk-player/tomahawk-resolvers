# Tomahawk Resolvers API

This documentation describes the [Tomahawk](https://www.tomahawk-player.org/) Resolver API, an API for uniform access to different music sources.
Although the main and initial purpose of the API was to provide source-independent streaming of music content for the desktop app, it evolved to general abstraction for music services that is used as part of *Tomahawk Desktop*, *Tomahawk Android* and are available in your [node.js/io.js environment](https://github.com/xhochy/node-tomahawkjs).

## The Idea

You can think of a *resolver* as being an adapter that at one site implements the service-indenpendent Tomahawk API and translates the requests coming from there to the native API calls of a music service.
Commonly the API functions in Tomahawk are a bit higher-level than those provided by the music service, thus a single call on the Tomahawk site may result in a small number of API calls to the music service (in most cases you'll end up doing only 1-2 calls).

As the Resolver API is the same across different music services, you can use the API to music-related apps that are agnostic of the underlying service.
This enables you to build an app that can support different services or move from one underlying service to another without any major code changes.

## Getting Started

**TODO**

## API Documentation

**TODO**

