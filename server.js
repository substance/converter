var fs = require('fs'),
    urlparser = require("url"),
    Converter = require('./src/converter');

// Fetching file by this function instead of internal pandoc method
// because of pandoc can't fetch files using https protocol
function getFile(url, cb) {

  var parts = urlparser.parse(url),
      protocol;

  // quick workaround
  // can be done better?
  if (parts.protocol === 'http:'){
    protocol = require('http');
  } else if(parts.protocol === 'https:') {
    protocol = require('https');
  }

  protocol.get(url, function(res) {
    var result = "";
    res.on('data', function ( d ) {
      result += d.toString();
    });
    res.on('end', function() {
      cb(null,result);
    });
  }).on('error', function( e ) {
    cb(err);
  });
}

// Spawn pandoc child process, run callback
// added some arguments for more capabilities 
function toPandoc(url, from, to, cb) {
  var spawn = require('child_process').spawn,
      args = [ '-f', from, '-t', to],
      result = '',
      error = '',
      child;
  getFile(url,function(err,res){
    child = spawn('pandoc',args);
    child.stdout.on('data', function (data) {
      result += data;
    });
    child.stderr.on('data', function (data) {
      error += data;
    });
    child.on('exit', function (code) {
      if (code != 0)
        return cb(new Error('pandoc exited with code ' + code + '.'));
      if (error)
        return cb(new Error(error));
      cb(null, JSON.parse(result));
    });
    child.stdin.write(res, 'utf8');
    child.stdin.end()
  });
}


// Convert to SUBSTANCE
// --------------------

var doc = '';

function toSubstance(url,syntax,id,cb){
  toPandoc(url, syntax, 'json', function(err, pandocJSON) {
    var converter = new Converter(pandocJSON,id);
    cb(null, converter.convert());
  });
}
module.exports = toSubstance;