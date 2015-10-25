var Tomahawk = Tomahawk || {};
Tomahawk.collections = [];
Tomahawk.PluginManager = new (require('tomahawk/plugin-manager').default);

// install RSVP error handler for uncaught(!) errors
RSVP.on('error', function (reason) {
    var resolverName = "";
    if (window.resolverInstance) {
        resolverName = window.resolverInstance.getSettings().name + " - ";
    }
    if (reason) {
        console.error(resolverName + 'Uncaught error:' + JSON.stringify(reason));
        if(reason.message) {
            console.error(resolverName + 'Uncaught error:', reason.message, reason.stack);
        }
    } else {
        console.error(resolverName + 'Uncaught error: error thrown from RSVP but it was empty');
    }
});
