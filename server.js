
var express = require('express'),
    fs = require('fs'),
    app = express(),
    _ = require('underscore'),
    urlparser = require("url"),
    Document = require('./lib/document/document'),
    util = require('./lib/util/util'),
    docSchema = require('./data/elife_schema');


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
          // var fs = require('fs');
          // fs.writeFile("pandoc.json", stdout, function(err) {
          //     if(err) {
          //         console.log(err);
          //     } else {
          //         console.log("The file was saved!");
          //     }
          // });
        cb(null, JSON.parse(stdout));
    });

    child.stdin.write(file);
    child.stdin.end();
  });
}

// Convert pandoc JSON output into substanc format
// Should output substance doc

function transform(json, cb) {

  var lastid = 0,
      offset = 0;

  function getId() {
    lastid += 1;
    return lastid;
  }

  var doc = new Document({id: "a_new_doc"}, docSchema);
  var elements = json[1];

  var fragments = [];
  var offset = 0;
  var annotations = {
    "annotations": [],
    "strong": [],
    "emphasis": [],
    "inline-code": [],
    "link": [],
    "idea": [],
    "error": [],
    "question": [],
    "comment": []
  };


  // Process
  // -------
  
  function process (node) {
    var nodeType = '';

    // inspect element
    if(typeof node === 'object'){
        if(Array.isArray(node)) {
          
          _.each(node, function (subNode){
            process(subNode);
          });

        }else{
          nodeType = _.first(Object.keys(node));
        }
    } else {
      nodeType = node;
    }

    // Shared internal actions
    // -----------------------

    function processAtomic (str){
      offset += str.length;
      for (var ann in annotations) {
        annotations[ann].push(str);
      }
      fragments.push(str);
    }

    function processInline (type){
      annotations[type] = []; // reset
      var start = offset;
      var val = process(node[nodeType]);
      console.log(type, val['annotations'][type]);
    }

    function processBlock (item) {
      fragments = []; // reset
      var res = process(item);
      console.log(nodeType + '::', res['text'].join(''));
    }

    function processSimple (item) {
      if(item){
        fragments = [];
        offset += item.length;
        fragments.push(item);
        console.log(nodeType + '::"', item, '"');
      }
    }

    function processList (type) {
      _.each(node[nodeType], function (li){
        fragments = [];
        switch (type) {
          case 'bl':
            res = process(li[0]['Plain']);
            console.log('bl > li', res['text'].join(''));
            break;

          case 'ol':
            // TODO: implement
            // ..... needs a well formated example
            break;

          case 'ul':
            // TODO: implement
            // ..... needs example
            break;
        }
      });
    }

    // console.log('typeof node', typeof node);
    // console.log('node', node);

    // Proceed Processing
    // ------------------

    switch (nodeType) {

      // Atomic content
      // --------------

      case 'Str':
        var str = node['Str'];
        processAtomic(str);
        break;
             
      case 'Space':
        var str = ' ';
        processAtomic(str);
        break;

      case 'LineBreak':
        var str = '\n';
        processAtomic(str);
        break;


      // Inline content
      // ---------------

      case 'Emph':
        var annType = 'emphasis';
        processInline(annType);
        break;

      case 'Strong':
        var annType = 'strong';
        processInline(annType);
        break;

      case 'Code':
        var annType = 'inline-code';
        processInline(annType);
        break;

      case 'Link':
        var annType = 'link';
        processInline(annType);
        break;


      // Block content
      // -------------

      case 'Header':
        var item = node[nodeType][1];
        processBlock(item);
        break;

      case 'Para':
      case 'Plain':
        var item = node[nodeType];
        processBlock(item);
        break;

      case 'OrderedList':
        processList('ol');
        break;

      case 'UnorderedList':
        processList('ul');
        break;

      case 'BulletList':
        processList('bl');
        break;

      case 'RawBlock':
      case 'CodeBlock':
        var item = node[nodeType][1];
        processSimple(item);
        break;

      case 'BlockQuote':
        // Find out why Para and if it always appears or further functionalities for BlockQuotes
        var item = node[nodeType][0]['Para']; 
        processBlock(item);
        break;


      case 'HorizontalRule':
        fragments = [];
        offset += 1;
        fragments.push('------');
        break;

    
      default:
        // if(nodeType.length > 1)
          // console.log('nodeType', nodeType);
        // console.log('node', node);
        break;

    }
    return {"text": fragments, "annotations": annotations};
  }


  _.each(elements, function (n) {
    // console.log('BLOCK::', 
      process(n);
      // );
  });

  cb(null, doc.toJSON());
}

// Convert to SUBSTANCE
// --------------------

// _mql: https and github works perfectly for me! you should fix your issues ;)

// var url = 'http://bywordapp.com/markdown/guide.md';
var url = 'https://dl.dropboxusercontent.com/u/606131/gh-flavored.md';
// var url = 'https://raw.github.com/michael/documents/master/2013-05-26-lens.md';
// var url = 'https://raw.github.com/dtao/lazy.js/master/README.md';
var doc = '';
toPandoc(url, function(err, pandocAST) {
  transform(pandocAST, function(err, substanceDoc) {
    doc = substanceDoc; // dev mode executes without reloading the page
  });
});

app.get('/', function(req, res) {
  res.jsonp(doc);
});

app.listen(process.env.PORT || 5001);
