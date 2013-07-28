var fs = require('fs'),
    _ = require('underscore'),
    urlparser = require("url");

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
    	console.log('processing')
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

// Convert pandoc JSON output into substance format
// Should output substance doc

function transformIn(json, doc_id, cb) {
	
  var lastid = 0,
      offset = 0;

  function getId() {
    lastid += 1;
    return lastid;
  }

  var doc = {id: doc_id};
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
	
	doc.nodes = {
		document: {
			type: "document",
    	id: "document",
    	views: [
    		"content",
      	"figures",
      	"publications"
    	],
    	guid: doc_id,
    	creator: "",
    	title: "",
    	abstract: "",
    	keywords: []
		},
		content: {
  		type: "view",
    	id: "content",
    	nodes: []
 	 	},
 	 	figures: {
      type: "view",
      id: "figures",
      nodes: []
    },
    publications: {
      type: "view",
      id: "publications",
      nodes: []
    }
	}

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
		//console.log(nodeType)
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
      var id = type+'_'+getId();
      doc.nodes[id] = {id: id, type: type}
      /*console.log('type: ' + type + ', data: ' )
      console.log(data)*/
      _.each(data, function(prop,key){
      	doc.nodes[id][key] = prop;
      	/*console.log('plain data: ' + data)
      	console.log('prop: ' +prop)
      	console.log('key: ' +key)*/
      })
      doc.nodes.content.nodes.push(id)
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
          "content": processBlock(node[nodeType][2])
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
        insert ('codeblock', {
          "lang": node[nodeType][0][1][0], 
          "content": processSimple(node[nodeType][1])
        }, ["figures", "back"]);
        break;

      case 'BlockQuote':
        // Find out why Para and if it always appears or further functionalities for BlockQuotes
        // Needs nodetype in the Document
        insert ('codeblock', {
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
  cb(null, doc);
}

// Convert to SUBSTANCE
// --------------------

// _mql: https and github works perfectly for me! you should fix your issues ;)

// var url = 'http://bywordapp.com/markdown/guide.md';
// var url = 'https://dl.dropboxusercontent.com/u/606131/gh-flavored.md';
//var url = 'https://raw.github.com/michael/documents/master/2013-05-26-lens.md';
// var url = 'https://raw.github.com/dtao/lazy.js/master/README.md';
//var url = 'https://dl.dropboxusercontent.com/u/606131/lens-intro.md';

var doc = '';

function toSubstance(url,syntax,id,cb){
	toPandoc(url, syntax, 'json', function(err, pandocJSON) {
		transformIn(pandocJSON, id, function(err,result){
			console.log('finished')
			if (err)
      	throw err;
      cb(null, result)
		});
	});
}
module.exports = toSubstance;