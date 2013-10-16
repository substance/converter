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

// NOTE: aeson 0.6.2 format uses {"tag": <type>, "contents": ...} which actually
// would have been nicer to use
// However, jgm bent his implementation back to conform to the former layout,
// which has the type as name of the first (and only) child of an object, and the content as its value.
// We use these functions to generalize the usage, just for the case that the jgm changes his decision

var _getType = function(node) {
  // E.g., "Space", "HorizontalRule"
  if (_.isString(node)) {
    return node;
  }
  return Object.keys(node)[0];
};

var _getContent = function(node, type) {
  if (_.isString(node)) {
    return [];
  }
  if (type === undefined) {
    type = _getType(node);
  }
  return node[type];
};

var _isTextish = function(node) {
  var type = _getType(node);
  return (type === "Str" || type === "Space" || _annotationTypes[type] !== undefined);
};

var _isInline = function(node) {
  var type = _getType(node);
  var content = _getContent(node, type);
  if (type === "Math") {
    return content[0] === "InlineMath";
  }
  return false;
};

var _isAnnotation = function(type) {
  return (_annotationTypes[type] !== undefined);
};

var _isParagraphElem = function(item) {
  return (_isTextish(item) || _isInline(item));
};

var PandocImporter = function() {
};

PandocImporter.Prototype = function() {

  var _segmentParagraphElements = function(input) {
    var blocks = [];
    var lastType = null;
    var last = null;
    for (var i = 0; i < input.length; i++) {
      var item = input[i];
      if (_isParagraphElem(item)) {
        if (lastType !== "Para") {
          lastType = "Para";
          last = { "Para": [] };
          blocks.push(last);
        }
        last["Para"].push(item);
      } else {
        blocks.push(item);
        last = item;
        lastType = _getType(item);
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
    var body = input[1];

    var doc = new Article({"id": meta.doc_id});
    state.doc = doc;

    if (meta.unMeta) {
      this.meta(state, meta.unMeta);
    }

    // this flattens the input so that some elements e.g., Image,
    // become top-level nodes.
    var idx;
    var nodes = [];
    for (idx = 0; idx < body.length; idx++) {
      var item = body[idx];
      var type = _getType(item);
      if (type === "Para") {
        nodes = nodes.concat(_segmentParagraphElements(_getContent(item, type)));
      } else {
        nodes.push(item);
      }
    }

    // all nodes on this level are inserted and shown
    for (idx = 0; idx < nodes.length; idx++) {
      var node = this.topLevelNode(state, nodes[idx]);
      if (!node) continue;

      if (_.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          doc.show("content", node[i].id, -1);
        }
      } else {
        doc.show("content", node.id, -1);
      }
    }

    // we are creating the annotations afterwards
    // to be sure that the annotated nodes are registered already
    for (idx = 0; idx < state.annotations.length; idx++) {
      doc.create(state.annotations[idx]);
    }

    return doc;
  };


  this.topLevelNode = function(state, input) {
    var type = _getType(input);
    var content = _getContent(input, type);

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
      case "Math":
        return this.math(state, content);
      case "Table":
        return this.table(state, content);
      case "DefinitionList":
        return this.definitions(state, content);
      default:
        throw new ImporterError("Node not supported: " + type);
    }

  };

  this.text = function(state, iterator) {
    if (_.isArray(iterator)) {
      iterator = new PandocImporter.Iterator(iterator);
    }
    var doc = state.doc;
    var id = state.nextId("text");
    var node = {
      id: id,
      type: "text"
    };
    state.push(node);
    node.content = this.annotatedText(state, iterator);
    state.pop();
    return doc.create(node);
  };

  this.header = function(state, input) {
    var doc = state.doc;

    var level = input[0];
    var source_id = input[1][0];
    var id = state.nextId("header");
    var node = {
      id: id,
      source_id: source_id,
      type: "heading",
      level: level,
      content: null
    };

    state.push(node);
    node.content = this.annotatedText(state, input[2]);
    state.pop();

    return doc.create(node);
  };

  this.paragraph = function(state, children) {
    var doc = state.doc;
    var nodes = [];
    var node;

    var iterator = new PandocImporter.Iterator(children);
    while (iterator.hasNext()) {
      var next = iterator.peek();
      var type = _getType(next);

      if (_isTextish(next)) {
        node = this.text(state, iterator);
      } else if (_isInline(next)) {
        if (type === "Math") {
          node = this.math(state, _getContent(iterator.next(), type));
        } else {
          throw new ImporterError("Paragraph Inline element not yet supported: " + type);
        }
      } else {
        throw new ImporterError("Node supported as element of a rich paragraph: " + type);
      }
      if (node) nodes.push(node);
    }

    if (nodes.length === 0) {
      return null;
    }
    // do not wrap single nodes into an extra paragraph
    else if (nodes.length == 1) {
      return nodes[0];
    }

    else {
      var id = state.nextId("paragraph");
      var paragraph = {
        id: id,
        type: "paragraph",
        children: _.map(nodes, function(n) {
          return n.id;
        })
      };
      return doc.create(paragraph);
    }
  };

  this.rawblock = function(state, input) {
    // Note: raw blocks are e.g. html comments.
    // Probably, depending on the raw block type (which is provided)
    // we could do different things...
    // E.g., if the raw-block was html and contained a comment we would be able
    // to create a comment node (instead of skipping)
    var type = input[0];
    if (type === "html") {
      // skip
      return null;
    } else {
      var doc = state.doc;
      var id = state.nextId("text");
      var node = {
        id: id,
        type: "text",
        content: input[1]
      };
      return doc.create(node);
    }
  };

  this.codeblock = function(state, input) {
    var doc = state.doc;
    var id = state.nextId("codeblock");
    var node = {
      id: id,
      "type": "codeblock",
      content: input[1]
    };
    return doc.create(node);
  };

  this.blockquote = function(state, input) {
    var doc = state.doc;
    for (var idx = 0; idx < input.length; idx++) {
      var item = input[idx];
      var type = _getType(item);
      var content = _getContent(item, type);

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

    var captionContent = input[0];
    var caption;
    if (captionContent) {
      caption = this.text(state, captionContent);

    }
    var url = input[1][0];

    var id = state.nextId("figure");
    var node = {
      id: id,
      type: "figure",
      url: url,
    };

    if (caption) {
      node.caption = caption.id;
    }

    return doc.create(node);
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
      // Note: a list item's content comes as array when it
      // contains a nested list
      var itemContent = input[idx];
      for (var j = 0; j < itemContent.length; j++) {
        var item = itemContent[j];
        var type = _getType(item);
        var content = _getContent(item, type);
        var listItem;
        switch (type) {
        case "Plain":
          listItem = this.paragraph(state, content);
          break;
        case "OrderedList":
          listItem = this.list(state, content, true);
          break;
        case "BulletList":
          listItem = this.list(state, content, false);
          break;
        default:
          throw new ImporterError("Node not supported as list item: " + JSON.stringify(item));
        }
        node.items.push(listItem.id);
      }
    }
    state.pop();

    return doc.create(node);
  };

  this.math = function(state, input) {
    var doc = state.doc;
    var mathType = input[0];
    var data = input[1].trim();

    var isInline = (mathType === "InlineMath");

    var id = state.nextId("formula");
    var formula = {
      id: id,
      type: "formula",
      data: data,
      format: "latex",
      inline: isInline
    };

    return doc.create(formula);
  };

  this.table = function(state, input) {
    var doc = state.doc;

    var id = state.nextId("table");
    var table = {
      id: id,
      type: "table",
      headers: [],
      cells: [],
      caption: null
    };

    var caption = this.text(state, input[0]);
    table.caption = caption.id;

    // TODO: what to do with that?
    // var alignments = input[1];
    // var somethingElse = input[2];

    var headerRow = input[3];
    var col, item, type, node;
    for (col = 0; col < headerRow.length; col++) {
      item = headerRow[col];
      if (item.length !== 1) {
        throw new ImporterError("Until now I have seen 1-element arrays only.");
      }
      item = item[0];
      type = _getType(item);
      if (type === "Plain") {
        node = this.text(state, _getContent(item, type));
        table.headers.push(node.id);
      } else {
        throw new ImporterError("Table cell type not supported: " + type);
      }
    }

    var body = input[4];
    for (var row = 0; row < body.length; row++) {
      var rowIds = [];
      var rowInput = body[row];
      for (col = 0; col < rowInput.length; col++) {
        item = rowInput[col];
        if (item.length !== 1) {
          throw new ImporterError("Until now I have seen 1-element arrays only.");
        }
        item = item[0];
        type = _getType(item);
        if (type === "Plain") {
          node = this.text(state, _getContent(item, type));
          rowIds.push(node.id);
        } else {
          throw new ImporterError("Table cell type not supported: " + type);
        }
      }
      table.cells.push(rowIds);
    }

    return doc.create(table);
  };

  this.definitions = function(state, definitionList) {
    var definitions = [];

    var descriptionNode, topicContent, topicNode, bodyContent, bodyNode;

    for (var i = 0; i < definitionList.length; i++) {
      var def = definitionList[i];

      topicContent = def[0];
      topicNode = this.text(state, topicContent);

      // TODO: this is a rather strange format... find out why
      bodyContent = def[1][0][0];
      bodyNode = this.topLevelNode(state, bodyContent);

      descriptionNode = {
        id: state.nextId("description"),
        type: "description",
        topic: topicNode.id,
        body: bodyNode.id
      };
      state.doc.create(descriptionNode);
      definitions.push(descriptionNode);
    }

    return definitions;
  };

  // Retrieves a text block from an array of textish fragments
  // and creates annotations on the fly.
  // --------
  //

  this.annotatedText = function(state, iterator, startPos) {
    var result = [];
    var pos = startPos || 0;

    if (_.isArray(iterator)) {
      iterator = new PandocImporter.Iterator(iterator);
    }

    var str;
    while(iterator.hasNext()) {
      var item = iterator.next();
      var type = _getType(item);

      if (type === "Space") {
        result.push(" ");
        pos++;
      } else if (type === "Str") {
        str = _getContent(item, type);
        result.push(str);
        pos += str.length;
      } else if (_isAnnotation(type)) {
        str = this.annotation(state, item, pos);
        result.push(str);
        pos += str.length;
      } else {
        iterator.back();
        break;
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

    var type = _getType(input);
    var children = _getContent(input, type);
    var iterator, content;

    if(type === 'Link') {
      options.url = children[1][0];
      iterator = new PandocImporter.Iterator(children[0]);
      content = this.annotatedText(state, iterator, startPos);
    }
    else if(type === 'Code') {
      content = children[1];
    }
    else {
      iterator = new PandocImporter.Iterator(children);
      content = this.annotatedText(state, iterator, startPos);
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
    var type = _getType(item);
    var content = _getContent(item, type);
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
      var type = _getType(item);
      switch (type) {
      case "Space":
        result.push(" ");
        break;
      case "Str":
        result.push(_getContent(item, type));
        break;
      default:
        console.error("Unknown type for MetaInlines ", type);
      }
    }
    return result.join("");
  };

};

PandocImporter.Iterator = function(elements) {
  this.elements = elements;
  this.length = this.elements.length;
  this.pos = -1;
};

PandocImporter.Iterator.prototype = {
  hasNext: function() {
    return this.pos < this.length - 1;
  },

  next: function() {
    this.pos += 1;
    return this.elements[this.pos];
  },

  peek: function() {
    return this.elements[this.pos+1];
  },

  back: function() {
    this.pos -= 1;
    return this;
  }
};


PandocImporter.prototype = new PandocImporter.Prototype();

module.exports = PandocImporter;
