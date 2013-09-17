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

var _annotationTypes = {
  "Emph": "emphasis",
  "Strong": "strong",
  "Link": "link",
  "Code": "code"
};

var _isAnnotation = function(type) {
  return (_annotationTypes[type] !== undefined);
};

var PandocImporter = function() {
};

PandocImporter.Prototype = function() {

  var _segmentParagraphElements = function(input) {
    var blocks = [];
    var last = {tag: "", contents: null};
    for (var i = 0; i < input.length; i++) {
      var item = input[i];
      var type = item.tag;
      if (type === "Image") {
        blocks.push(item);
        last = item;
      } else {
        if (last.tag !== "Para") {
          last = {tag: "Para", contents: []};
          blocks.push(last);
        }
        last.contents.push(item);
      }
    }

    return blocks;
  };

  this.import = function(input) {
    var state = new State();
    return this.document(state, input);
  };

  this.document = function(state, input) {
    var meta = input[0];

    var doc = new Article({"id": meta.doc_id});
    state.doc = doc;

    if (meta.unMeta) {
      this.meta(state, meta.unMeta);
    }

    // Note: First we segment paragraphs into chunks, so that e.g., images are top-level
    var idx;
    var nodes = [];
    for (idx = 0; idx < input[1].length; idx++) {
      var item = input[1][idx];
      if (item.tag === "Para") {
        nodes = nodes.concat(_segmentParagraphElements(item.contents));
      } else {
        nodes.push(item);
      }
    }

    // all nodes on this level are inserted and shown
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
    var type = input.tag;
    var content = input.contents;

    switch(type) {
      case "HorizontalRule":
        return false;
      case "Header":
        return this.header(state, content);
      case "Para":
        return this.paragraph(state, content);
      case "CodeBlock":
        return this.codeblock(state, content);
      case 'RawBlock':
        return this.rawblock(state, content);
      case 'BlockQuote':
        return this.blockquote(state, content);
      case "BulletList":
        return this.list(state, content, false);
      case "OrderedList":
        return this.list(state, content, true);
      case "Image":
        return this.figure(state, content);
      default:
        throw new ImporterError("Node not supported: " + type);
    }
  };

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

  this.paragraph = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("text");
    var node = {
      id: id,
      type: "text",
      content: null
    };

    state.push(node);
    node.content = this.text(state, input);
    state.pop();

    return doc.create(node);
  };

  this.rawblock = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("text");
    var node = {
      id: id,
      type: "text",
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
      var item = input[idx];
      var type = item.tag;
      var content = item.contents;

      var quote;
      if (type === "Para") {
        quote = this.paragraph(state, content);
        doc.show("content", quote.id, -1);
      }
      else if (type === "BlockQuote") {
        this.blockquote(state, content);
      }
      else {
        throw new ImporterError("Node not supported as blockquote: " + JSON.stringify(quote));
      }
    }

    return false;
  };

  this.figure = function(state, input) {
    var doc = state.doc;

    var img_id = state.nextId("image");
    var url = input[1][0];
    var img = {
      id: img_id,
      type: "image",
      url: url
    };
    doc.create(img);

    var captionId = this.caption(state, input[0]);

    var id = state.nextId("figure");
    var node = {
      id: id,
      type: "figure",
      image: img_id,
      caption: captionId
    };

    return doc.create(node);
  };

  this.caption = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("text");
    var node = {
      id: id,
      type: "text",
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
      // Note: an item's content comes as an array
      // we do not support this, howevere, keep it in mind...
      var item = input[idx][0];
      var type = item.tag;
      var content = item.contents;

      var listItem;

      if (type === "Plain") {
        listItem = this.paragraph(state, content);
      }
      else {
        throw new ImporterError("Node not supported as list item: " + JSON.stringify(item));
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

    var str;
    for (var i = 0; i < textFragments.length; i++) {
      var item = textFragments[i];
      var type = item.tag;
      var content = item.contents;

      switch(type) {
      case "Space":
        result.push(" ");
        pos++;
        break;
      case "Str":
        str = content;
        result.push(str);
        pos += str.length;
        break;
      default:
        if (_isAnnotation(type)) {
          str = this.annotation(state, item, pos);
          result.push(str);
          pos += str.length;
        }
        else {
          throw new ImporterError("Unsupported fragment for textish: " + item);
        }
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

    var type = input.tag;
    var children = input.contents;

    var content;

    if(type === 'Link') {
      options.url = children[1][0];
      content = this.text(state, children[0], startPos);
    }
    else if(type === 'Code') {
      content = children[1];
    }
    else {
      content = this.text(state, children, startPos);
    }

    var endPos = startPos + content.length;

    var annotationType = _annotationTypes[type];
    var id = state.nextId(annotationType);
    var annotation = _.extend({
      id: id,
      type: annotationType,
      path: [targetNode.id, "content"],
      range: [startPos, endPos]
    },options);

    state.annotations.push(annotation);

    return content;
  };

  this.meta = function(state, meta) {
    var doc = state.doc;

    if (Object.keys(meta).length === 0) {
      return;
    }

    var metaData;
    if (_.isObject(meta)) {
      metaData = this.metaMap(state, meta);
    }

    if (metaData) {
      console.log("setting meta data", metaData);
      doc.set(["document", "meta"], metaData);
    }
  };

  this.getMetaValue = function(state, item) {
    var type = item.tag;
    var content = item.contents;
    var val;
    switch (type) {
    case "MetaMap":
      val = this.metaMap(state, content);
      break;
    case "MetaList":
      val = this.metaList(state, content);
      break;
    case "MetaInlines":
      val = this.metaInlines(state, content);
      break;
    default:
      val = content;
    }
    return val;
  };

  this.metaMap = function(state, metaMap) {
    var result = {};
    _.each(metaMap, function(item, name) {
      result[name] = this.getMetaValue(state, item);
    }, this);
    return result;
  };

  this.metaList = function(state, metaList) {
    var result = [];
    _.each(metaList, function(item) {
      result.push(this.getMetaValue(state, item));
    }, this);
    return result;
  };

  this.metaInlines = function(state, metaInlines) {
    var result = [];
    for (var i = 0; i < metaInlines.length; i++) {
      var item = metaInlines[i];
      var type = item.tag;
      switch (type) {
      case "Space":
        result.push(" ");
        break;
      case "Str":
        result.push(item.contents);
        break;
      default:
        console.error("Unknown type for MetaInlines ", type);
      }
    }
    return result.join("");
  };

};

PandocImporter.prototype = new PandocImporter.Prototype();

module.exports = PandocImporter;
