
var express = require('express'),
    fs = require('fs'),
    app = express(),
    _ = require('underscore'),
    urlparser = require("url"),
    Document = require('./lib/document/document'),
    util = require('./lib/util/util');

// Convert pandoc JSON output into substanc format
// Should output substance doc
function convert(pandocAST, cb) {

  var lastid = 0;
  function getId() {
    lastid += 1;
    return lastid;
  }

  var doc = new Document({id: "a_new_doc"});
  var elements = pandocAST[1];

  // parses text objects into strings
  function getText(pieces) {
    var res = "";
    _.each(pieces, function(piece) {

      if (piece === "Space") {
        res += " ";
      } else if (piece["Emph"]) {
        // Emphasis object
        // todo: implement properly
        res += getText(piece["Emph"]);
      } else if (piece["Strong"]) {
        // Strong object
        // todo: implement properly
        res += getText(piece["Strong"]);
      } else if (piece["Link"]) {
        // link object
        // todo: implement properly
        res += piece["Link"][1][0];
      } else if (piece["Str"]) {
        // propably a Str object
        res += piece["Str"];
      }
    });
    
    return res;
  }

  // we loop through each converted element
  _.each(elements, function(elem) {

    // inspect element
    if(typeof elem === 'object'){
        var nodeType = _.first(Object.keys(elem));
    } else {
      // horizontalrule doesnt come as an object
      // todo cover all the cases
      var nodeType = elem;
    }

    // Headings
    if (nodeType === 'Header') {
      // Insert a new heading
      doc.apply(["insert", {
        "id": "heading:"+getId(),
        "type": "heading",
        "target": "back",
        "data": {
          "level": elem[nodeType][0],
          "content": getText(elem[nodeType][1])
        }
      }]);
    }

    // Text
    if (nodeType === 'Para') {
      // Insert a new text node
      doc.apply(["insert", {
        "id": "text:"+getId(),
        "type": "text",
        "target": "back",
        "data": {
          "content": getText(elem[nodeType])
        }
      }]);
    }
  });

  cb(null, doc.toJSON());
}

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
      cb(null, result);
    });
  }).on('error', function( e ) {
    cb(err);
  });
}

function toPandoc(url, cb) {

  getFile(url, function(err, file) {
    var exec = require('child_process').exec,
        child;

    child = exec('pandoc -f markdown -t json',
      function (error, stdout, stderr) {
        if (error) return cb(err);
        cb(null, JSON.parse(stdout));
    });

    child.stdin.write(file);
    child.stdin.end();
  });
}


// Convert to SUBSTANCE
// -------------

app.get('/', function(req, res) {
  var url = 'http://bywordapp.com/markdown/guide.md';
  // _mql: this works perfectly for me! you should fix your issues ;)
  // var url = 'https://raw.github.com/dtao/lazy.js/master/README.md';

  toPandoc(url, function(err, pandocAST) {
    convert(pandocAST, function(err, substanceDoc) {
      res.jsonp(substanceDoc);
    });
  });
});

app.listen(process.env.PORT || 5001);
