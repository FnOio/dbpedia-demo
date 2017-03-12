var fs = require('fs'),
    path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, 'dev.html'), 'utf8');
var map = fs.readFileSync(path.resolve(__dirname, 'resources', 'map.json'), 'utf8');
var config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf8'));

html = html.replace(/<%MAP%>/g, map);
html = html.replace(/<%ENDPOINT%>/g, config.endpoint);

fs.writeFileSync(path.resolve(__dirname, 'index.html'), html, 'utf8');
