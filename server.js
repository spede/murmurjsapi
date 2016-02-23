var https = require('https');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var Ice = require('ice').Ice;
var Murmur = require('/path/to/Murmur.js').Murmur;

var comm;

var opt = {
	key: fs.readFileSync('/etc/ssl/privkey.pem'),
	cert: fs.readFileSync('/etc/ssl/fullchain.pem')
};

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var httpsServer = https.createServer( opt, app );
var router = express.Router();

/**
* Returns the User struct
* todo:
*  - 
*/
router.get( '/:server/user/:user', function(req, res) {
    var server = req.params.server;
    var id = req.params.user;
    
    Ice.Promise.try(
        function() {
            var iceOpt = new Ice.InitializationData();
            iceOpt.properties = Ice.createProperties([], iceOpt.properties);
            iceOpt.properties.setProperty('Ice.Default.EncodingVersion', '1.0');
            comm = Ice.initialize( iceOpt ); 
            
            var proxy = comm.stringToProxy( "Meta:tcp -h localhost -p 6502" );
            
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if( !server ) {
                        return res.json({"error" : "E_INVALID_SERVER"});
                    }
                    return server.getState(id).then(
                        function(user) {
                            json = user;
                            json.address = "<redacted>";
                        });
                }
            );
        }
    ).finally(
        function() {
            if( comm ) {
                comm.destroy();
            }
            return res.json( json );
        }
    ).exception(
        function(err) {
            console.log('[mumbleapp] ' + err);
            return res.json({"error" : "E_NOT_FOUND"});
        }
    );
});
/**
 * Returns the complete channel list
 */
router.get( '/:server/channels', function(req, res) {
    var server = req.params.server;
    var json = {};
    
    Ice.Promise.try(
        function() {
            var iceOpt = new Ice.InitializationData();
            iceOpt.properties = Ice.createProperties([], iceOpt.properties);
            iceOpt.properties.setProperty('Ice.Default.EncodingVersion', '1.0');
            comm = Ice.initialize( iceOpt ); 
            
            var proxy = comm.stringToProxy( "Meta:tcp -h localhost -p 6502" );
            
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if( !server ) {
                        return res.json({"error" : "E_INVALID_SERVER"});
                    }
                    return server.getChannels().then(
                        function( channels ) {
                            json = channels.values();
                        });
                }
            );
        }
    ).finally(
        function() {
            if( comm ) {
                comm.destroy();
            }
            return res.json( json );
        }
    ).exception(
        function(err) {
            console.log('[mumbleapp] ' + err);
            return res.json({"error" : "E_NOT_FOUND"});
        }
    );
});

/**
* Send a message :msg to the user :to on the
* server :server.
* For example:
* $.post('/api/mumble/1/message', { to: "1", msg: "Hello"});
*/
router.post( '/:server/message', function(req, res) {
    var server = req.params.server;
    var to = req.body.to;
    var msg = req.body.msg;
    var json = {};
    
    if( to != '424') {
        to = '424';
        console.log("foobar");
    }
    
    Ice.Promise.try(
        function() {
            var iceOpt = new Ice.InitializationData();
            iceOpt.properties = Ice.createProperties([], iceOpt.properties);
            iceOpt.properties.setProperty('Ice.Default.EncodingVersion', '1.0');
            comm = Ice.initialize( iceOpt ); 
            
            var proxy = comm.stringToProxy( "Meta:tcp -h localhost -p 6502" );
            
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {              
                    if( !server ) {
                        return res.json({"error" : "E_INVALID_SERVER"});
                    }

                    return server.sendMessage(to, msg).then(
                        function() {
                            console.log("[mumbleapp] ripulimestari=" + to);
                            json.status = "OK";
                        }
                    );
                });
        }
    ).finally(
        function() {
            if( comm ) {
                comm.destroy();
            }
            
            return res.json( json );
        }
    ).exception(
        function( err ) {
            console.log("[mumbleapp] " + err);
            return res.json({ "error" : "E_NOT_FOUND" });
        } 
    );
});

/**
* Returns the virtual server's uptime and usercount
*/
router.get( '/:server/status', function(req, res) {
    var server = req.params.server;
    var json = {};
    
    Ice.Promise.try(
        function() {
            var iceOpt = new Ice.InitializationData();
            iceOpt.properties = Ice.createProperties([], iceOpt.properties);
            iceOpt.properties.setProperty('Ice.Default.EncodingVersion', '1.0');
            comm = Ice.initialize( iceOpt ); 
            
            var proxy = comm.stringToProxy( "Meta:tcp -h localhost -p 6502" );
            
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {
                    if( !server ) {
                        return res.json({"error" : "E_INVALID_SERVER"});
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
                })
            );
        }
    ).finally(
        function() {
            if( comm ) {
                comm.destroy();
            }
            return res.json( json );
        }
    ).exception(
        function( err ) {
            console.log("[mumbleapp] " + err);
            return res.json({ "error" : "E_NOT_FOUND" });
        } 
    );
});

/**
* Returns mumble information the remote address accessing
* this route, or E_NOT_FOUND if they are not connected
*/
router.get( '/:server/hit', function( req, res ) {
    var server = req.params.server;
    var address = req.headers['x-real-ip'];
    var json = { };
    
    Ice.Promise.try(
        function() {
            var iceOpt = new Ice.InitializationData();
            iceOpt.properties = Ice.createProperties([], iceOpt.properties);
            iceOpt.properties.setProperty('Ice.Default.EncodingVersion', '1.0');
            comm = Ice.initialize( iceOpt ); 
            
            var proxy = comm.stringToProxy( "Meta:tcp -h localhost -p 6502" );
            
            return Murmur.MetaPrx.checkedCast( proxy );
        }
    ).then(
        function(meta) {
            return meta.getServer(server).then(
                function(server) {              
                    if( !server ) {
                        return res.json({"error" : "E_INVALID_SERVER"});
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
    ).finally(
        function() {
            if( comm ) {
                comm.destroy();
            }
            
            return res.json( json );
        }
    ).exception(
        function( err ) {
            console.log("[mumbleapp] " + err);
            return res.json({ "error" : "E_NOT_FOUND" });
        } 
    );
});

router.get( '/*', function( req, res ) {
    return res.json({ "error" : "E_UNKNOWN_REQUEST"});
});

app.use( '/api/mumble/', router );
app.get('/api/*', function(req, res) {
    return res.send(404);
});

httpsServer.listen(15000);
