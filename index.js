var fs = require('fs');
var exec = require('child_process').exec;
var config = require('./config');
var restify = require('restify');

var app = restify.createServer();

app.use(restify.jsonp());
app.use(restify.queryParser());
app.use(restify.bodyParser());

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function updateDns(serial, servers) {
    var nsServers = [];
    var apiServers = [];
    var europeServers = [];
    var usServers = [];
    for (i in servers) {
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
                "ns": nsServers,
                "a": usServers
            },
            'europe': {
                'a': europeServers
            }
        }
    };
    for (i in servers) {
        var item = servers[i];
        dnsFile['data'][item['name']] = { 'a': [ [item['ip'], 0] ] }
    }
    fs.writeFile('/opt/geodns/dns/api.bukget.org.json', JSON.stringify(dnsFile), 'utf8', function (err) {});
    exec("initctl restart geodns", function(error, stdout, stderr) {}); 
    console.log("Updated dns!");
}

app.post('/dnsupdate', function (req, res, next) {
    if (req.params.key != config.key) {
        res.send(403);
        return;
    }
    res.send(200);
    updateDns(req.params.serial, JSON.parse(req.params.servers));
});

var port = process.env.PORT || 5555
app.listen(port);
console.log("Listening on: " + port);