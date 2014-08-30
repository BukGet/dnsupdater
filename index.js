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

function updateDns(serial, servers) {
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
    fs.writeFile('/opt/geodns/dns/api.bukget.org.json', JSON.stringify(dnsFile), 'utf8', function (err) {});
    exec('initctl restart geodns', function(error, stdout, stderr) {}); 
    console.log('Updated dns!');
}

app.get('/serial', function (req, res, next) {
    res.send({ 'serial': lastSerial });
});

app.post('/dnsupdate', function (req, res, next) {
    console.log(req.params);
    console.log(config.key);
    if (req.params.key != config.key) {
        res.send(403);
        return;
    }
    res.send(200);
    updateDns(req.params.serial, JSON.parse(req.params.servers));
});

unirest.get('http://monitor.bukget.org/currentDNS').as.json(function (response) {
    if (response.error) {
      console.log('Couldn\'t get current dns config');
      return;
    }
    updateDns(response.body['serial'], response.body['servers']);
});

var port = process.env.PORT || 5555
app.listen(port);
console.log('Listening on: ' + port);