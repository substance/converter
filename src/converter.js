"use strict";

var _ = require('underscore');
var Document = require('substance-document');
var Data = require('substance-data');

// Substance.Converter
// -------------------
var Converter = function(input,doc_id) {
  this.input = input;
  this.doc_id = doc_id || "foo_doc";
};


Converter.Prototype = function() {

  this.output = function() {
    var doc = this.input;
    var nodesList = doc.get("content").nodes;
    var content = [];
    
    // Process nodes
    function process(node) {
      var nodeType = node.type;
      
      function splitUp(node) {
      
        var regex = new RegExp('(\\.{3}|\\w+\\-\\w+|\\w+\'(?:\\w+)?\|\\w+|\s*)');
        
        function cleanUp(splitted) {
          var result=[];//_.filter(splitted,function(str){return str!=''});
          _.each(splitted,function(str){
            if(str == ' '){
              result.push('Space');
            }
            else if (str == ''){
            }
            else {
              result.push({"Str":str});
            }
          });
          return result;
        }
        return cleanUp(node.split(regex));
      }
      
      function makeId(node) {
        return node.replace(/['";:,.\/?\\-]/g, '').split(' ').join('-').toLowerCase();
      }
      
      switch (nodeType) {
        case 'paragraph':
          var atomic = splitUp(node.content);
          content.push({"Para":atomic});
          break;
        case 'heading':
          var atomic = splitUp(node.content);
          var id = makeId(node.content);
          content.push({"Header":[node.level,[id,[],[]],atomic]});
          break;
        case 'codeblock':
          break;
        case 'image':
          break;
        case 'emphasis':
          break;
        case 'strong':
          break;
        default:
          break;  
      };

    };
    
    _.each(nodesList, function(nodeid){
    	var node = doc.get(nodeid);
      process(node);
    });
    
    content = [{
      "docTitle": [],
      "docAuthors": [],
      "docDate": []
    },content];
    
    return content;
  };

  // Do the actual conversion
  this.convert = function() {
    var json = this.input;
    var doc_id = this.doc_id;
    // The resulting Substance Doc
    var doc = new Document({"id": this.doc_id});

    var lastid = 0,
        lastpid = 0,
        offset = 0;

    function getId() {
      lastid += 1;
      return lastid;
    }
    
    function getPId() {
      lastpid += 1;
      return lastpid;
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

    // Process nodes
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
              console.log(res['text'].join(''))
              break;

            case 'ol':
        			if(!_.isUndefined(li[0][0])){
        				res = process(li[0][0]['Plain']);
        				list += res['text'].join('') + '\n';
        			}
              break;

            case 'ul':
              res = process(li[0]['Plain']);
              list += '* ' + res['text'].join('') + '\n';
              break;
          }
        });
        return list;
      }

      // Insert node into document
      function insert (type, data, target) {
        if(type == 'paragraph') {
          var id = type+'_'+getPId();
        } else {
          var id = type+'_'+getId();
        }
        lastNodeId = id;
        // insert a new node
        var node = _.extend({
          id: id,
          type: type
        }, data);

        doc.create(node);
        doc.position("content", [id], -1);
      }


      // Proceed processing
      switch (nodeType) {

        // Atomic content
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
        case 'Emph':
          var annType = 'emphasis';
          var start = offset;
          var txt = processInline(annType);
          var len = txt.length;
          insert(annType,{
          	"node": 'paragraph_' + (lastpid + 1),
            "property": "content",
            "range": [start, start + len]
          });
          break;

        case 'Strong':
          var annType = 'strong';
          var start = offset;
          var txt = processInline(annType);
          var len = txt.length;
          insert(annType,{
          	"node": 'paragraph_' + (lastpid + 1),
            "property": "content",
            "range": [start, start + len]
          });
          break;

        case 'Code':
          /*var annType = 'inline-code';
          processInline(annType);*/
          processAtomic(node[nodeType][1])
          break;

        case 'Link':
          var annType = 'link';
          var start = offset;
          var txt = processInline(annType);
          var len = txt.length;
          var url = node["Link"][1][0];
          insert(annType,{
          	"node": 'paragraph_' + (lastpid + 1),
            "property": "content",
            "range": [start, start + len],
            "url": url
          });
          break;

        // Block content
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
          insert ('paragraph', {
            "subtype": "ol",
            "content": processList('ol')
          });
          break;

        case 'UnorderedList':
          insert ('paragraph', {
            "subtype": "ul",
            "content": processList('ul')
          });
          break;

        case 'BulletList':
          insert ('paragraph', {
            "subtype": "bl",
            "content": processList('bl')
          });
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