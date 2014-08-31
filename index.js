var fs = require('fs');
var exec = require('child_process').exec;
var config = require('./config');
var restify = require('restify');
var unirest = require('unirest');

var app = restify.createServer();
var lastSerial = 0;

app.use(restify.jsonp());
app.use(restify.queryParser());
app.use(restify.bodyParser());

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function updateDns(serial, servers, callback) {
    lastSerial = serial;
    var nsServers = [];
    var apiServers = [];
    var europeServers = [];
    var usServers = [];
    for (var i in servers) {
        var item = servers[i];
        nsServers.push(item['ns']);
        if (item['region'] == 'us') {
            usServers.push([item['ip'], 0]);
        } else if (item['region'] == 'europe') {
            europeServers.push([item['ip'], 0]);
        }
    }
    var dnsFile = {
        'serial': serial,
        'ttl': 120,
        'contact': 'staff.bukget.org',
        'data': {
            '': {
                'ns': nsServers
            }
        }
    };
    if (usServers.length > 0) {
        dnsFile.data[''].a = usServers;
    } else {
        dnsFile.data[''].a = europeServers;
    }
    if (europeServers.length > 0) {
        dnsFile.data.europe = {
            'a': europeServers
        }
    }
    for (var i in servers) {
        var item = servers[i];
        dnsFile['data'][item['name']] = { 'a': [ [item['ip'], 0] ] }
    }
    fs.writeFile(config.dnsFile, JSON.stringify(dnsFile), 'utf8', function (err) {
        if (err) {
            console.log('Error writing DNS config file');
            console.trace(err);
            callback(true);
        }
        exec('initctl restart geodns', function(error, stdout, stderr) {
            console.log('Updated dns!');
            callback(false);
        }); 
    });
}

app.get('/serial', function (req, res, next) {
    res.send({ 'serial': lastSerial });
});

app.post('/dnsupdate', function (req, res, next) {
    console.log('Incoming DNS update request');
    console.log(req.params);
    if (req.params.key != config.key) {
        return res.send(403);
    }
    updateDns(req.params.serial, JSON.parse(req.params.servers), function (err) {
        if (err) {
            return res.send(500);
        }
        return res.send(200);
    });
});

unirest.get('http://monitor.bukget.org/currentDNS').as.json(function (response) {
    if (response.error) {
      console.log('Couldn\'t get current dns config');
      return;
    }
    updateDns(response.body['serial'], response.body['servers'], function (err) {
        if (err) {
            return console.log('Initial DNS sync failed');
        }
        console.log('Initial DNS sync successful');
    });
});

app.listen(process.env.PORT || 5555, function () {
  console.log('Listening on: %s', app.url);
});