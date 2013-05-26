
var express = require('express'),
    fs = require('fs'),
    app = express(),
    _ = require('underscore'),
    urlparser = require("url"),
    Document = require('./lib/document/document'),
    util = require('./lib/util/util'),
    docSchema = require('./data/elife_schema');

// Convert pandoc JSON output into substanc format
// Should output substance doc
function convert(pandocAST, cb) {

  var lastid = 0,
      offset = 0;

  function getId() {
    lastid += 1;
    return lastid;
  }

  var doc = new Document({id: "a_new_doc"}, docSchema);
  var elements = pandocAST[1];

  // parses text objects into strings
  function extractValues(pieces) {
    var res = "";
    _.each(pieces, function(piece) {

      if (typeof piece === "object") {

        if (piece["LineBreak"]) {
          res += "\n";
        } else if (piece["Emph"]) {
          // Emphasis object
          // todo: implement properly
          res += extractValues(piece["Emph"]);
        } else if (piece["Strong"]) {
          // Strong object
          // todo: implement properly
          res += extractValues(piece["Strong"]);
        } else if (piece["Link"]) {
          console.log('piece["Link"]', piece["Link"]);
          // link object
          // todo: implement properly
          res += extractValues(piece["Link"][0]) + ': ';
          res += piece["Link"][1][0];
        } else if (piece["Image"]) {
          
          if(res === ''){ // not supporting inline images at the moment
            res =  {
              "type": "image",
              "data": {
                  "alt": extractValues(piece["Image"][0]),
                  "title": piece["Image"][1][1],
                  "large_url": piece["Image"][1][0],
                  "url": piece["Image"][1][0]
             }
            };
          }

        } else if (piece["RawInline"]) {
          // link object
          // todo: implement properly
          res += piece["RawInline"][1];
        } else if (piece["Str"]) {
          // propably a Str object
          res += piece["Str"];
        } else{
          res += extractValues(piece);
        }

      }else{

        if (piece === "Space") {
          res += " ";
        } else if(piece === "LineBreak") {
          res += "\n";
        }
      }

    });

    offset += res.length;
    return res;
  }

  // takes the returned value and inserts it or calls callback
  function processResult (result, cb) {
    if(typeof result === 'object'){

        result.id = result.type + ":" + getId();
        result.target = ["figures", "back"];
        doc.apply(["insert", result]);

      } else {
        cb();
      }
  }

  // we loop through each converted element
  _.each(elements, function(elem) {

    // inspect element
    if(typeof elem === 'object'){
        var nodeType = _.first(Object.keys(elem));
    } else {
      // Some elements come as strings
      var nodeType = elem;
    }

    // Headings
    if (nodeType === 'Header') {
      var result = extractValues(elem[nodeType][1]);
      processResult (result, function () {
        // Insert a new heading
        doc.apply(["insert", {
          "id": "heading:" + getId(),
          "type": "heading",
          "target": "back",
          "data": {
            "level": elem[nodeType][0],
            "content": extractValues(elem[nodeType][1])
          }
        }])
      });

    // Text
    } else if (nodeType === 'Para') {
      var result = extractValues(elem[nodeType]);
      processResult (result, function () {
        // Insert a new text node
        doc.apply(["insert", {
          "id": "text:"+getId(),
          "type": "text",
          "target": "back",
          "data": {
            "content": extractValues(elem[nodeType])
          }
        }])
      });

    // Text
    } else if (nodeType === 'Plain') {
      // todo: implement
      doc.apply(["insert", {
        "id": "text:"+getId(),
        "type": "text",
        "target": "back",
        "data": {
          "subtype": "plain", // quick hack to find the nodes in the json later
          "content": extractValues(elem[nodeType])
        }
      }]);

    // List
    } else if (nodeType === 'BulletList') {
      // todo: implement properly
      var list = "";
      _.each(elem[nodeType], function (item) {
        list += "* " + extractValues(item) + "\n";
      });
      doc.apply(["insert", {
        "id": "text:"+getId(),
        "type": "text",
        "target": "back",
        "data": {
          "subtype": "list", // quick hack to find the nodes in the json later 
          "content": list
        }
      }]);

    // Raw
    } else if (nodeType === 'RawBlock') {
      // todo: implement
      doc.apply(["insert", {
        "id": "text:"+getId(),
        "type": "text",
        "target": "back",
        "data": {
          "subtype": "raw", // quick hack to find the nodes in the json later 
          "content": elem[nodeType][1]
        }
      }]);

     // Quote
    } else if (nodeType === 'BlockQuote') {
      // todo: implement
      doc.apply(["insert", {
        "type": "codeblock",
        "target": ["figures", "back"],
        "data": {
          "content": extractValues(elem[nodeType])
         }
      }]);

    // Code
    } else if (nodeType === 'CodeBlock') {
      // todo: implement properly
      // Insert a new code node
      doc.apply(["insert", {
        "id": "codeblock:"+getId(),
        "type": "codeblock",
        "target": "back",
        "data": {
          "content": elem[nodeType][1]
        }
      }]);

   // Hr?
   } else if (nodeType === 'HorizontalRule') {
      // todo: implement - but how?
      doc.apply(["insert", {
        "id": "text:"+getId(),
        "type": "text",
        "target": "back",
        "data": {
          "subtype": "hr", // quick hack to find the nodes in the json later
          "content": '------------------------'
        }
      }]);

      
    } else {
      // console.log('nodeType', nodeType);
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
  // _mql: https and github works perfectly for me! you should fix your issues ;)

  // var url = 'http://bywordapp.com/markdown/guide.md';
  // var url = 'https://dl.dropboxusercontent.com/u/606131/gh-flavored.md';
  var url = 'https://raw.github.com/michael/documents/master/2013-05-26-lens.md';
  // var url = 'https://raw.github.com/dtao/lazy.js/master/README.md';

  toPandoc(url, function(err, pandocAST) {
    convert(pandocAST, function(err, substanceDoc) {
      res.jsonp(substanceDoc);
    });
  });
});

app.listen(process.env.PORT || 5001);
