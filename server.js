/**
* Attempt at a RESTful JS/ice api for 
* Mumble server
*
* Teemu Malinen 2016
* https://github.com/spede/murmurjsapi
*/

var https = require('https');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var Ice = require('ice').Ice;
var Murmur = require('./Murmur.js').Murmur;
var sprintf = require('sprintf-js').sprintf;
var app = express();
var router = express.Router();
var opt = {
	key: fs.readFileSync('/path/to/privkey.pem'),
	cert: fs.readFileSync('/path/to/fullchain.pem')
};

// Need to match what you've got in mumble-server.ini
// todo: move to a configuration file.
var host = 'localhost';
var port = 6502;
// When false use unsecured connection
var secret = false;
var communicator;
// listens for https when true

var httpsServer = https.createServer(opt, app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
* Initiate a promise
*/
function ice(res) {
    return new Ice.Promise.try(
        function() {
            var iceOptions = new Ice.InitializationData();
            iceOptions.properties = Ice.createProperties([], iceOptions.properties);
            // This seems required with newer versions of zeroc-ice
            iceOptions.properties.setProperty('Ice.Default.EncodingVersion', '1.0');

            if( secret !== false ) {
                iceOptions.properties.setProperty('Ice.ImplicitContext', 'Shared');
                ice.getImplicitContext().put('secret', secret);
            }

            communicator = Ice.initialize( iceOptions );
            var proxy = communicator.stringToProxy(sprintf('Meta:tcp -h %s -p %s', host, port));
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    process.exit(1);
                break;
            }
        }
    );
}

/**
* Kick user :user from server :server
* because of :reason
* todo:
* authentication
*/
router.post( '/:server/kick', function(req, res) {
    var server = req.params.server;
    var user = req.body.target;
    var reason = req.body.reason;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id" });
                    }
                    server.kickUser(user).then(
                        function() {
                            json.status = "OK";
                    });
                }
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id" });
                break;
                case "Murmur::InvalidSessionException":
                    return res.json({ "error": "No such user"});
                break;
                case "Ice::MarshalException":
                    return res.json({"error": "/kick requires a session id as an argument"});
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }
            return res.json(json);
        }
    );
});

/**
 * Returns the full UserMap for server
 * :server
 */
router.get( '/:server/users', function(req, res) {
    var server = req.params.server;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if( !server ) {
                        return res.json({"error": "Invalid server id"});
                    }
                    return server.getUsers().then(
                        function(users) {
                            var copy = users.values();
                            // redact ip addresses
                            // from public-facing APIs
                            // remove if undesirable
                            for( i = 0; i < copy.length; i++) {
                                copy[i].address = '<redacted>';
                            }
                            json = copy;
                        }
                    );
                }
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Virtual server offline" });
                break;
            }
        }
    ).finally(
        function() {
            if(communicator) {
                communicator.destroy();
            }
            return res.json(json);
        }
    );
});

/**
* Returns the User struct for :user (session id)
* on :server
*/
router.get( '/:server/user/:user', function(req, res) {
    var server = req.params.server;
    var id = req.params.user;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id" });
                    }
                    return server.getState(id).then(
                        function(user) {
                            json = user;
                            json.address = "<redacted>";
                        });
                }
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id" });
                break;
                case "Murmur::InvalidSessionException":
                    return res.json({ "error": "No such user"});
                break;
                case "Ice::MarshalException":
                    return res.json({"error": "/user requires a session id as an argument"});
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }
            return res.json( json );
        }
    );
});

/**
* Returns the User struct for :user (name)
* on server :server.
*/
router.get( '/:server/userbyname/:name', function(req, res) {
    var server = req.params.server;
    var reqUserName = req.params.name;
    var json = {"error": "User not found"};
    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error":"Invalid server id"});
                    }
                    return server.getUsers().then(
                        function(users) {
                            users.values().forEach(function(u) {
                                if( u.name == reqUserName ) {
                                    json = u;
                                    json.address = '<redacted>';
                                }
                            });
                        }
                    );
                }  
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::InvalidSessionException":
                    return res.json({ "error": "No such user"});
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if(communicator) {
                communicator.destroy();
            }
            return res.json(json);
        }
    );
});

/**
 * Returns the full ChannelMap
 */
router.get( '/:server/channels', function(req, res) {
    var server = req.params.server;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id"});
                    }
                    return server.getChannels().then(
                        function( channels ) {
                            json = channels.values();
                        });
                }
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id" });
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }
            return res.json( json );
        }
    );
});

/**
* Send a message :msg to the user :to on the
* server :server
*/
router.post( '/:server/message', function(req, res) {
    var server = req.params.server;
    var to = req.body.target;
    var msg = req.body.msg;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id" });
                    }

                    return server.sendMessage(to, msg).then(
                        function() {
                            json.status = "OK";
                        }
                    );
                });
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id"});
                break;
                case "Murmur::InvalidSessionException":
                    return res.json({ "error": "No such user"});
                break;
                case "Ice::MarshalException":
                    return res.json({"error": "/message needs a session id as the first argument"});
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }
            return res.json( json );
        }
    );
});

/**
* Returns the virtual server's uptime, userCount
* and registeredUserCount
*/
router.get( '/:server/status', function(req, res) {
    var server = req.params.server;
    var json = {};

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id" });
                    }
                    return server;
                }
            );
        }
    ).then(
        function(server) {
            return Ice.Promise.all(
                server.getUptime().then(
                    function(t) {
                        json.uptime = t.toString();
                }),
                server.getUsers().then(
                    function(u) {
                        json.userCount = u.values().length.toString();
                }),
		server.getRegisteredUsers('').then(
		    function(r) {
			json.registeredUserCount = r.values().length.toString();
		})
            );
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id" });
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }
            return res.json( json );
        }
    );
});

/**
* Returns mumble information the remote address calling
* this route, or { "error": "User not found" } when not found
*/
router.get( '/:server/hit', function( req, res ) {
    var server = req.params.server;
    var address = req.headers['x-real-ip'];
    var json = { };

    ice(res).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if(!server) {
                        return res.json({"error": "Invalid server id" });
                    }
                    return server.getUsers();
                }
            );
        }
    ).then(
        function(users) {
            users.values().forEach( function(user) {
                var serverAddress = user.address.slice(12).join('.');
                if( serverAddress == address ) {
                    json.id = user.session.toString();
                    json.name = user.name;
                    json.channel = user.channel.toString();
                    json.ping = user.udpPing.toPrecision(4);
                    return true;
                }
            });
            if( !json.id ) json = { "error": "E_NOT_FOUND" };
        }
    ).exception(
        function(error) {
            switch(error.ice_name()) {
                case "Murmur::ServerBootedException":
                    return res.json({ "error": "Invalid server id" });
                break;
                default:
                    console.log(sprintf('[mumbleapi]: %s', error ));
                    return res.json({ "error": "Uncaught error"});
                break;
            }
        }
    ).finally(
        function() {
            if( communicator ) {
                communicator.destroy();
            }

            return res.json( json );
        }
    );
});

router.get( '/*', function( req, res ) {
    return res.json({ "error" : "E_UNKNOWN_REQUEST"});
});

app.use( '/api/mumble/', router );
app.get('/api/*', function(req, res) {
    return res.sendStatus(404);
});

httpsServer.listen(15000);
