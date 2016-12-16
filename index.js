var app = require('express')();
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data
var fs = require('fs'),
    path = require('path'),
    child_process = require('child_process');


app.use(bodyParser.text({limit: '1mb'})); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/_dbpedia', upload.array(), function (req, res, next) {
    var doc = req.body;
    var file = path.resolve(__dirname, 'tmp', '' + (new Date()).getTime() + '.map.ttl');
    fs.writeFile(file, doc, 'utf8', function(err) {
        if (err) {
            return close(res, file, 500, err);
        }
        var process = child_process.spawn('java', ['-jar', path.resolve(__dirname, 'resources', 'DBpedia-Mapper-1.0-SNAPSHOT-shaded.jar'), file]);
        var output = '';
        process.stdout.on('data', function(data) {
            output += data;
        });
        process.stderr.on('data', function(data) {
            console.error(data.toString());
        });
        process.on('close', function(code) {
            if (code !== 0) {
                return close(res, file, 500);
            }
            var tripleStart = output.indexOf('<http');
            if (tripleStart === -1) {
                return close(res, file, 500, 'no triples generated!');
            }
            output = output.slice(tripleStart).replace('{{wikititle}}', 'Belgium').trim();
            return close(res, file, 200, output);
        });
    });
});

function close(res, file, status, output, cb) {
    status = status || 200;
    output = output || '';
    cb = cb || function() {};
    fs.unlink(file, function(err) {
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

app.listen(9999, function () {
    console.log('Example app listening on port 9999!')
});