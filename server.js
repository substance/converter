
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
      return val['annotations'][type];
    }

    function processBlock (item, ins) {
      fragments = []; // reset
      var res = process(item);
      return res['text'].join('');
    }

    function processSimple (item) {
      fragments = [];
      offset += item.length;
      fragments.push(item);
      return item;
    }

    function processList (type) {
      var list = '';
      _.each(node[nodeType], function (li){
        fragments = [];
        switch (type) {
          case 'bl':
            res = process(li[0]['Plain']);
            list += '* ' + res['text'].join('') + '\n';
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
      return list;
    }

    function insert (type, data, target) {
      var target = "back" || target;
      doc.apply(["insert", {
        "id": type + ":" + getId(),
        "type": type,
        "target": target,
        "data": data
      }]);
    }


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
        // var annType = 'link';
        // var start = offset;
        // var txt = processInline('link');
        // var len = txt.length;

        // doc.apply(["insert", {
        //   "id":  "annotation:" + getId(),
        //   "type": annType,
        //   "node": "text:??",
        //   "pos": [start,len]
        // }]);
        
        //  doc.apply(["insert", {
        //     "type": "link",
        //     "id": "annotation:351",
        //     "source": "text:350",
        //     "target": null,
        //     "key": "content",
        //     "content": "review process",
        //     "pos": [398, 14],
        //     "url": "http://www.elifesciences.org/the-journal/review-process"
        // }]);


        break;


      // Block content
      // -------------

      case 'Header':
        insert ('heading', {
          "level": node[nodeType][0], 
          "content": processBlock(node[nodeType][1])
        });

        break;

      case 'Para':
      case 'Plain':
        insert ('text', {
          "content": processBlock(node[nodeType])
        });
        break;

      case 'OrderedList':
        insert ('text', {
          "subtype": "ol",
          "content": processList('ol')
        });
        break;

      case 'UnorderedList':
        insert ('text', {
          "subtype": "ul",
          "content": processList('ul')
        });
        break;

      case 'BulletList':
        insert ('text', {
          "subtype": "bl",
          "content": processList('bl')
        });
        break;

      case 'RawBlock':
      case 'CodeBlock':
        insert ('code', {
          "lang": node[nodeType][0], 
          "content": processSimple(node[nodeType][1])
        }, ["figures", "back"]);
        break;

      case 'BlockQuote':
        // Find out why Para and if it always appears or further functionalities for BlockQuotes
        // Needs nodetype in the Document
        insert ('code', {
          "subtype": "blocQuote",
          "content": processBlock(node[nodeType][0]['Para'])
        });
        break;

      case 'HorizontalRule':
        // for now we fake HR
        // should we skip it all the way?
        offset += 1;
        insert ('text', {
          "content": '------'
        });
        break;

      case 'Image':
        // var alt = process(node[nodeType][0]);
        fragments = []; // reset
        var res = process(node[nodeType][0]);
        var alt = res['text'].join('');
        var url = node[nodeType][1][0];
        var title = node[nodeType][1][1];

        insert('image', {
                  "alt": alt,
                  "title": title,
                  "large_url": url,
                  "url": url
        });
        break;

    
      default:
        // if(nodeType.length > 1)
          // console.log(nodeType);
        // console.log('node', node);
        break;

    }
    return {"text": fragments, "annotations": annotations};
  }

  _.each(elements, function (n) {
      process(n);
  });

  cb(null, doc.toJSON());
}

// Convert to SUBSTANCE
// --------------------

// _mql: https and github works perfectly for me! you should fix your issues ;)

// var url = 'http://bywordapp.com/markdown/guide.md';
// var url = 'https://dl.dropboxusercontent.com/u/606131/gh-flavored.md';
var url = 'https://raw.github.com/michael/documents/master/2013-05-26-lens.md';
// var url = 'https://raw.github.com/dtao/lazy.js/master/README.md';
// var url = 'https://dl.dropboxusercontent.com/u/606131/lens-intro.md';

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
