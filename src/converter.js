"use strict";

var _ = require('underscore');
var Document = require('substance-document');

// Substance.Converter
// ==========================================================================

var Converter = function(pandocJSON) {
  this.input = pandocJSON;
};


Converter.Prototype = function() {

  // Do the actual conversion
  // ----------
  // 

  this.convert = function() {
    var json = this.input;

    // The resulting Substance Doc
    var doc = new Document({"id": "foo_doc"});

    var lastid = 0,
        offset = 0;

    function getId() {
      lastid += 1;
      return lastid;
    }

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
      "question": []
    };

    // Process
    // -------
    
    function process(node) {
      var nodeType = '';
      var lastNodeId;

      // inspect element
      if(typeof node === 'object'){
          if(Array.isArray(node)) {
            _.each(node, function (subNode){
              process(subNode);
            });
          } else {
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

      // Test
      // ---------------------

      function insert (type, data, target) {
        var id = type+'_'+getId();
        lastNodeId = id;

        // insert a new node
        var node = _.extend({
          id: id,
          type: type
        }, data);

        doc.create(node);
        doc.position("content", [id], -1);
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
          var annType = 'link';
          var start = offset;
          var txt = processInline('link');
          var len = txt.length;
          var url = node["Link"][1][0];

          doc.create({
            "id": annType+"_" + getId(),
            "type": annType,
            "node": lastNodeId,
            "property": "content",
            "range": [start, len],
            "url": url
          });
          break;

        // Block content
        // -------------

        case 'Header':
          insert ('heading', {
            "level": node[nodeType][0], 
            "content": processBlock(node[nodeType][2])
          });

          break;

        case 'Para':
        case 'Plain':
          insert ('paragraph', {
            "content": processBlock(node[nodeType])
          });
          break;

        case 'OrderedList':
          // insert ('text', {
          //   "subtype": "ol",
          //   "content": processList('ol')
          // });
          break;

        case 'UnorderedList':
          // insert ('text', {
          //   "subtype": "ul",
          //   "content": processList('ul')
          // });
          break;

        case 'BulletList':
          // insert ('text', {
          //   "subtype": "bl",
          //   "content": processList('bl')
          // });
          break;

        case 'RawBlock':
        case 'CodeBlock':
          insert ('codeblock', {
            "lang": node[nodeType][0][1][0],
            "content": processSimple(node[nodeType][1])
          }, ["figures", "back"]);
          break;

        case 'BlockQuote':
          // Find out why Para and if it always appears or further functionalities for BlockQuotes
          // Needs nodetype in the Document
          // insert ('codeblock', {
          //   "subtype": "blocQuote",
          //   "content": processBlock(node[nodeType][0]['Para'])
          // });
          break;

        case 'HorizontalRule':
          // for now we fake HR
          // should we skip it all the way?
          // offset += 1;
          // insert ('text', {
          //   "content": '------'
          // });
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
                    "url": url
          });
          break;
      
        default:
          // if(nodeType.length > 1)
          break;

      }
      return {"text": fragments, "annotations": annotations};
    }

    _.each(elements, function (n) {
      process(n);
    });

    return doc;
  };
};


Converter.prototype = new Converter.Prototype();

module.exports = Converter;