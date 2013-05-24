var express = require('express');
var fs = require('fs');
var app = express();
var https  = require('https');
var http  = require('http');
var _ = require('underscore');
// var Github = require('./lib/github');
var Document = require('./lib/document/document');
var util = require('./lib/util/util');

// Should output substance doc
// function loadMarkdown(username, repo, branch, path, cb) {
//   var github = new Github({});
//   var repo = github.getRepo(username, repo);
//   repo.read(branch, path, cb);
// }

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

  function getText(pieces) {
    var res = "";
    _.each(pieces, function(piece) {
      if (piece === "Space") {
        res += " ";
      } else if (piece["Str"]) {
        // propably a Str object
        res += piece["Str"];
      }
    });
    console.log('res', res);
    return res;
  }

  _.each(elements, function(elem) {
    // inspect element
    var nodeType = _.first(Object.keys(elem));

    if (nodeType === 'Header') {
      // Extract plain text for heading

      // Insert a new 
      doc.apply(["insert", {
        "id": "heading:"+getId(),
        "type": "heading",
        "target": "back",
        "data": {
          "content": getText(elem[nodeType][2])
        }
      }]);
    }

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



function getFile(url, cb) {
  http.get(url, function(res) {
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



// Convert to SUBSTANCE
// -------------

app.get('/', function(req, res) {
  toPandoc('http://ma.zive.at/hello.md', function(err, pandocAST) {
    convert(pandocAST, function(err, substanceDoc) {
      res.jsonp(substanceDoc);
    });
  });
});



app.listen(process.env.PORT || 5001);
