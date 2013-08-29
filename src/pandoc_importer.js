"use strict";

var _ = require("underscore");
var Article = require("substance-article");
var ImporterError = require("./converter_errors").ImporterError;

var State = function() {
  // an id generator for different types
  var ids = {};
  this.nextId = function(type) {
    ids[type] = ids[type] || 0;
    ids[type]++;
    return type +"_"+ids[type];
  };

  var stack = [];

  this.current = function() {
    return stack[stack.length-1];
  };

  this.push = function(node) {
    stack.push(node);
  };

  this.pop = function() {
    return stack.pop();
  };

  this.annotations = [];
};

var Annotations = {
  "Emph": "emphasis",
  "Strong": "strong",
  "Link": "link",
  "Code": "code"
};

var _isAnnotation = function(item) {
  for(var id in Annotations) {
    if(item[id] !== undefined) {
      return true;
    }
  }
  return false;
};

var _getAnnotationData = function(item) {
  for(var id in Annotations) {
    if(item[id] !== undefined) {
      return {type: Annotations[id], fragments: item[id]};
    }
  }
};

var PandocImporter = function() {
};

PandocImporter.Prototype = function() {

  this.import = function(input) {
    var state = new State();
    return this.document(state, input);
  };

  this.document = function(state, input) {
    var meta = input[0];
    var doc = new Article({"id": meta.doc_id});
    var idx;

    state.doc = doc;

    // all nodes on this level are inserted and shown
    var nodes = input[1];
    for (idx = 0; idx < nodes.length; idx++) {
      var node = this.topLevelNode(state, nodes[idx]);
      if(node) doc.show("content", node.id, idx);
    }

    // we are creating the annotations afterwards
    // to be sure that the annotated nodes are registered already
    for (idx = 0; idx < state.annotations.length; idx++) {
      doc.create(state.annotations[idx]);
    }

    return doc;
  };


  this.topLevelNode = function(state, input) {
    if (input == 'HorizontalRule') {
      return false;
    }
    var type = Object.keys(input)[0];

    switch(type) {
      case "Header":
        return this.header(state, input["Header"]);
      case "Para":
        // TODO: why is that?
        if (!_.isUndefined(input["Para"][0].Image)) {
          return this.figure(state, input["Para"][0].Image);
        }
        else {
          return this.paragraph(state, input["Para"]);
        }
        break;
      case "CodeBlock":
        return this.codeblock(state, input["CodeBlock"]);
      case 'RawBlock':
        return this.rawblock(state, input["RawBlock"]);
      case 'BlockQuote':
        return this.blockquote(state, input["BlockQuote"]);
      case "BulletList":
        return this.list(state, input["BulletList"], false);
      case "OrderedList":
        return this.list(state, input["OrderedList"], true);
      case "Image":
        return this.figure(state, input["Image"]);
      default:
        throw new ImporterError("Node not supported: " + type);
    }

  };

  /*
  Example:
    {
        "Header": [
            1,
            [
                "heading",
                [],
                []
            ],
            [
                {
                    "Str": "Heading"
                }
            ]
        ]
    },
  */
  this.header = function(state, input) {
    var doc = state.doc;

    var level = input[0];
    var id = state.nextId("header");
    var node = {
      id: id,
      type: "heading",
      level: level,
      content: null
    };

    state.push(node);
    node.content = this.text(state, input[2]);
    state.pop();

    return doc.create(node);
  };

  /*
  Example:
  {
      "Para": [
          {
              "Str": "And"
          },
          "Space",
          {
              "Str": "a"
          },
          "Space",
          {
              "Str": "paragraph"
          }
      ]
  }
  */
  this.paragraph = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("paragraph");
    var node = {
      id: id,
      type: "paragraph",
      content: null
    };

    state.push(node);
    node.content = this.text(state, input);
    state.pop();

    return doc.create(node);
  };

  this.rawblock = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("paragraph");
    var node = {
      id: id,
      type: "paragraph",
      content: null
    };

    state.push(node);
    node.content = input[1];
    state.pop();

    return doc.create(node);
  };

  this.codeblock = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("codeblock");
    var node = {
      id: id,
      "type": "codeblock",
      content: null
    };

    state.push(node);
    node.content = input[1];
    state.pop();

    return doc.create(node);
  };

  this.blockquote = function(state, input) {
    var doc = state.doc;
    for (var idx = 0; idx < input.length; idx++) {
      var itemInput = input[idx];
      var quote;
      if (itemInput["Para"]) {
        quote = this.paragraph(state, itemInput["Para"]);
        doc.show("content", quote.id, -1);
      }
      else if (itemInput["BlockQuote"]) {
        this.blockquote(state, itemInput["BlockQuote"]);
      }
      else {
        throw new ImporterError("Node not supported as blockquote: " + JSON.stringify(quote));
      }
    }

    return false;
  };

  this.figure = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("figure");
    var node = {
      id: id,
      type: "figure",
      image: null,
      caption: null,
    };

    id = state.nextId("image");
    var url = input[1][0];
    var img = {
      id: id,
      type: "image",
      url: url
    };
    doc.create(img);
    node.image = img.id;

    state.push(node);
    if (!_.isEmpty(input[0])){
      node.caption = this.caption(state, input[0]);
    }
    state.pop();

    return doc.create(node);
  };

  this.caption = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("caption");
    var node = {
      id: id,
      type: "paragraph",
      content: null
    };
    state.push(node);
    node.content = this.text(state, input);
    state.pop();

    doc.create(node);
    return id;
  };

  this.list = function(state, input, ordered) {
    var doc = state.doc;

    var id = state.nextId("list");
    var node = {
      id: id,
      type: "list",
      items: [],
      ordered: ordered
    };

    state.push(node);
    if (ordered) {
      input = input[1];
    }
    for (var idx = 0; idx < input.length; idx++) {
      var itemInput = input[idx];
      if (itemInput.length !== 1) {
        throw new ImporterError("Oops. Not ready for that. Can only handle one item per list item");
      }
      // TODO: find out why this is provided as array
      itemInput = itemInput[0];

      var listItem;

      if (itemInput["Plain"]) {
        listItem = this.paragraph(state, itemInput["Plain"]);
      }
      else {
        throw new ImporterError("Node not supported as list item: " + JSON.stringify(itemInput));
      }
      node.items.push(listItem.id);
    }
    state.pop();

    return doc.create(node);
  };

  // Retrieves a text block from an array of textish fragments
  // and creates annotations on the fly.
  // --------
  //

  this.text = function(state, textFragments, startPos) {
    var result = [];
    var pos = startPos || 0;

    for (var i = 0; i < textFragments.length; i++) {
      var item = textFragments[i];

      if (item === "Space") {
        result.push(" ");
        pos++;
      }
      else if (item["Str"]) {
        var str = item["Str"];
        result.push(str);
        pos += str.length;
      }
      else if (_isAnnotation(item)) {
        var content = this.annotation(state, item, pos);
        result.push(content);
        pos += content.length;
      }
      else {
        throw new ImporterError("Unsupported fragment for textish: " + item);
      }
    }

    return result.join("");
  };

  // Create an annotation that begins at the given startPos
  // --------
  //

  this.annotation = function(state, input, startPos) {
    var targetNode = state.current();
    if (targetNode === undefined) {
      throw new ImporterError("No target for annotation available");
    }
    var options = {};

    var data = _getAnnotationData(input);

    var type = data.type;

    var fragments, content;

    if(type == 'link') {
      fragments = data.fragments[0];
      options.url = data.fragments[1][0];
      content = this.text(state, fragments, startPos);
    }
    else if(type == 'code') {
      fragments = data.fragments[1];
      content = fragments;
    }
    else {
      fragments = data.fragments;
      content = this.text(state, fragments, startPos);
    }

    var endPos = startPos + content.length;

    var id = state.nextId(type);
    var annotation = _.extend({
      id: id,
      type: type,
      path: [targetNode.id, "content"],
      range: [startPos, endPos]
    },options);

    state.annotations.push(annotation);

    return content;
  };

};

PandocImporter.prototype = new PandocImporter.Prototype();

module.exports = PandocImporter;
