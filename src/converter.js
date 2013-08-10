"use strict";

var _ = require('underscore');
var Article = require('substance-article');

// A contains method has been added to Strings in Javascript 1.8.6:
// https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/contains
if (typeof String.prototype.contains === 'undefined') { 
  String.prototype.contains = function(ch) { 
    return this.indexOf(ch) != -1; 
  };
}

// Substance.Converter
// -------------------
// 
// Converts Pandoc Input to a Substance Article

var Converter = function(input, doc_id) {
  this.input = input;
  this.doc_id = doc_id || "foo_doc";
};


Converter.Prototype = function() {

  this.output = function() {
    var doc = this.input,
        nodesList = doc.get("content").nodes,
        content = [],
        punctuations = ',.;:"?!';
    
    function getAnnotations(id){
      var anns = _.filter(doc.nodes,function(node){
      	if(_.isUndefined(node.path)){
      	  return false;
      	} else {
      	  return node.path[0] == id;
      	}
      })
      if (_.isEmpty(anns)) return false;
      return anns;
    }
    
    // Process nodes
    function process(node) {
      var nodeType = node.properties.type;

      function makeHeaderId(node) {
        return node.replace(/['";:,.\/?\\-]/g, '').split(' ').join('-').toLowerCase();
      }
      
      function processNode(node) {
        
        var result = [],
            annotations = getAnnotations(node.properties.id),
            currentWord = 0,
            annWord = 0,
            ranges = _.flatten(_.pluck(annotations,'range')),
            annCounter = 0,
            currentRange = null;
            
        
        function processAnn(contents,annotation) {
          var ann = [];
          _.each(contents.split(''), function(ch, index) {
          	if(punctuations.contains(ch)) {
            	ann.push({"Str":ch});
            	annWord++
          	}
          	else if(ch == ' ') {
            	ann.push('Space');
            	annWord++
          	}
          	else {
            	if(!ann[annWord]) ann[annWord] = {'Str':''};
            	ann[annWord].Str += ch;
            	if(contents[index+1] == ' ' || punctuations.contains(contents[index + 1])) annWord++;
          	}
		    	});
		    	
		    	switch (annotation.type) {
		    	  case 'strong':
		    	    ann = {
		    	      "Strong":ann
              }
		    	    break;
		    	  case 'emphasis':
		    	    ann = {
		    	      "Emph":ann
              }
		    	    break;
		    	  case 'link':
		    	    ann = {
		    	      "Link":[ann,[annotation.url,""]]
              }
		    	    break;
		    	  default:
		    	    ann = {
		    	      "Emph":ann
              }
		    	    break;
		    	}
		    	annWord = 0;
		    	return ann;
        } 
        
        _.each(node.properties.content.split(''), function(ch, index) {
          if(ranges.indexOf(index) != -1) {
            var ann = annotations[annCounter],
                annContent = node.properties.content.substr(ann.range[0],ann.range[1]-ann.range[0]),
                type = ann.type,
                annObj = processAnn(annContent,ann);
            ranges.splice(0,2);
            annCounter++;
            currentRange = ann.range[1];
            result.push(annObj);
            currentWord++;
          } else {
            if(_.isNull(currentRange) || (index>=currentRange)){
              if(punctuations.contains(ch)) {
                result.push({"Str":ch});
                currentWord++;
              }
              else if(ch == ' ') {
                result.push('Space');
                currentWord++;
              }
              else {
                if(!result[currentWord]) result[currentWord] = {'Str':''};
                result[currentWord].Str += ch;
                if(node.properties.content[index+1] == ' ' || punctuations.contains(node.properties.content[index + 1]) || ranges.indexOf(index + 1) != -1) currentWord++;
              }
            }
          }
		    });
		    return result;
      }
      
      switch (nodeType) {
        case 'paragraph':
          var atomic = processNode(node);
          content.push({"Para":atomic});
          break;
        case 'heading':
          var atomic = processNode(node);
          var id = makeHeaderId(node.content);
          content.push({"Header":[node.properties.level,[id,[],[]],atomic]});
          break;
        case 'codeblock':
          var atomic = processNode(node);
          content.push({"CodeBlock":[["",[],[]],node.properties.content]});
          break;
        case 'image':
          content.push({"Para":[{"Image":[[],[node.properties.url,""]]}]});
          break;
        default:
          var atomic = processNode(node);
          content.push({"Para":atomic});
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

    console.log('CONVERTING....', json);
    var doc_id = this.doc_id;

    // The resulting Substance Doc
    var doc = new Article({"id": this.doc_id});

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