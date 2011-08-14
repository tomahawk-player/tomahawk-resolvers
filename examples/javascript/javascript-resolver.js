/*
 * (c) 2011 Dominik Schmidt <domme@tomahawk-player.org>
 */

var DummyResolver = Tomahawk.extend(TomahawkResolver,
{
    settings:
    {
        name: 'Dummy Resolver',
        weight: 75,
        timeout: 5
    },
    resolve: function( qid, artist, album, title )
    {
        return this.search( qid, title );
    },
    search: function( qid, searchString )
    {
        return {
            qid: qid,
            results: [
                {
                    artist: "Mokele",
                    album: "You Yourself are Me Myself and I am in Love",
                    track: "Hiding In Your Insides (php)",
                    source: "Mokele.co.uk",
                    url: "http://play.mokele.co.uk/music/Hiding%20In%20Your%20Insides.mp3",
                    bitrate: 160,
                    duration: 248,
                    size: 4971780,
                    score: 1.0,
                    extension: "mp3",
                    mimetype: "audio/mpeg"
                }
            ]

        };
    }
});

Tomahawk.resolver.instance = DummyResolver;