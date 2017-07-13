var app = require('express')();
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data
var fs = require('fs'),
  path = require('path'),
  child_process = require('child_process'),
  jsonld = require('jsonld');

if (!fs.existsSync(path.resolve(__dirname, 'tmp'))) {
  fs.mkdirSync(path.resolve(__dirname, 'tmp'));
}

var apicache = require("apicache");
var cache = apicache.middleware;

// app.use(cache('5 hours'));

var config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf8'));
var http = require('http');
var https = null;
if (config.https) {
  https = require('https');
  var privateKey = fs.readFileSync(config.key, 'utf8');
  var certificate = fs.readFileSync(config.cert, 'utf8');

  var credentials = {key: privateKey, cert: certificate};
}

app.use(bodyParser.text({limit: '1mb'})); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

app.use(function (req, res, next) { // cross-origin! :D
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// TODO return mapping document together with data

app.post('/_dbpedia', upload.array(), function (req, res, next) {
  var input = JSON.parse(req.body);
  var file = path.resolve(__dirname, 'tmp', '' + (new Date()).getTime() + '.map.ttl');
  jsonld.normalize(input.map, {
    algorithm: 'URDNA2015',
    format: 'application/nquads'
  }, function (err, normalized) {
    if (err) {
      return closeJson(res, file, 500, {err: err});
    }
    fs.writeFile(file, normalized, 'utf8', function (err) {
      if (err) {
        return closeJson(res, file, 500, {err: err});
      }
      var process = child_process.spawn('java', ['-jar', path.resolve(__dirname, 'resources', 'DBpedia-Mapper-1.0-SNAPSHOT-shaded.jar'), file, input.wiki]);
      var output = '';
      process.stdout.on('data', function (data) {
        output += data;
      });
      process.stderr.on('data', function (data) {
        console.error(data.toString());
      });
      process.on('close', function (code) {
        if (code !== 0) {
          return closeJson(res, file, 500, {err: 'java process error!'});
        }
        var tripleStart = output.indexOf('<http');
        if (tripleStart === -1) {
          return closeJson(res, file, 500, {err: 'no triples generated!'});
        }
        output = output.replace(/".+ = /g, '"');
        output = output.slice(tripleStart).replace('{{wikititle}}', 'Belgium').trim();
        var result = {
          triples: output,
          mapping: normalized
        };
        return closeJson(res, file, 200, result);
      });
    });
  });
});

app.use(function (req, res, next) {
  res.status(404).send('Sorry cant find that!')
});

function closeTurtle(res, file, status, output, cb) {
  status = status || 200;
  output = output || '';
  cb = cb || function () {
    };
  fs.unlink(file, function (err) {
    if (err) {
      console.error(err.message);
    }
    if (status !== 200) {
      return cb(res.status(status).send(output));
    }
    res.set('Content-Type', 'text/turtle');
    return cb(res.status(status).send(output));
  });
}

function closeJson(res, file, status, output, cb) {
  status = status || 200;
  output = output || '';
  cb = cb || function () {
    };
  fs.unlink(file, function (err) {
    if (err) {
      console.error(err.message);
    }
    if (status !== 200) {
      return cb(res.status(status).send(output));
    }
    res.set('Content-Type', 'application/json');
    return cb(res.status(status).send(JSON.stringify(output)));
  });
}

var port = process.argv[2] || 8999;


var httpServer = http.createServer(app);
httpServer.listen(port, function () {
  console.log('Example app listening on port ' + port + '!');
});

if (config.https) {
  var httpsServer = https.createServer(credentials, app);
  port -= 1;
  httpsServer.listen(port, function () {
    console.log('Example https  app listening on port ' + port + '!');
  });
}
