"use strict";

var _ = require('underscore');
var util = require('substance-util');

/**
 * EXPERIMENTAL
 */

var HTMLConverter = function dmHtmlConverter( options ) {
  this.options = options || {};
};

HTMLConverter.Prototype = function HTMLConverterPrototype() {

  this.createState = function(doc, htmlDoc) {
    var state = {
      doc: doc,
      htmlDoc: htmlDoc,
      annotations: [],
      trimWhitespaces: !!this.options.trimWhitespaces,
      contexts: [],
      lastChar: "",
      skipTypes: {},
      ignoreAnnotations: false,
    };
    return state;
  };

  this.convert = function(htmlDoc, doc) {
    var state = this.createState(doc, htmlDoc);
    var body = htmlDoc.getElementsByTagName( 'body' )[0];
    this.body(state, body);
    // create annotations afterwards so that the targeted nodes
    // exist for sure
    for (var i = 0; i < state.annotations.length; i++) {
      doc.create(state.annotations[i]);
    }
  };

  var _topLevelElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5'];

  var _isTopLevel = function(type) {
    return _topLevelElements.indexOf(type) >= 0;
  };

  this.body = function(state, body) {
    // HACK: this is not a general solution just adapted to the
    // content provided by pasting from Microsoft Word: when pasting
    // only some words of a paragraph then there is no wrapping p element
    var catchBin = null;
    var handlers = {
      'p': this.paragraph,
      'h1': this.heading,
      'h2': this.heading,
      'h3': this.heading,
      'h4': this.heading,
      'h5': this.heading,
    };
    var childIterator = new HTMLConverter.ChildNodeIterator(body);
    while(childIterator.hasNext()) {
      var child = childIterator.next();
      var type = this.getNodeType(child);
      if (handlers[type]) {
        // if there is an open catch bin node add it to document and reset
        if (catchBin && catchBin.content.length > 0) {
          state.doc.create(catchBin);
          state.doc.show('content', catchBin.id);
          catchBin = null;
        }
        var node = handlers[type].call(this, state, child);
        if (node) {
          state.doc.show('content', node.id);
        }
      } else {
        // Wrap all other stuff into a paragraph
        if (!catchBin) {
          catchBin = {
            type: 'text',
            id: util.uuid('text'),
            content: ''
          };
        }
        state.contexts.push({
          path: [catchBin.id, 'content']
        });
        catchBin.content += this._annotatedText(state, childIterator, catchBin.content.length);
        state.contexts.pop();
      }
    }
    if (catchBin && catchBin.content.length > 0) {
      state.doc.create(catchBin);
      state.doc.show('content', catchBin.id);
      catchBin = null;
    }
  };

  this.paragraph = function(state, el) {
    var textNode = {
      type: 'text',
      id: el.id || util.uuid('text'),
      content: null,
    };
    textNode.content = this.annotatedText(state, el, [textNode.id, 'content']);
    state.doc.create(textNode);
    return textNode;
  };

  this.heading = function(state, el) {
    var headingNode = {
      type: 'heading',
      id: el.id || util.uuid('heading'),
      content: null,
      level: -1
    };
    var type = this.getNodeType(el);
    headingNode.level = parseInt(type.substring(1));
    headingNode.content = this.annotatedText(state, el, [headingNode.id, 'content']);
    state.doc.create(headingNode);
    return headingNode;
  };

  /**
   * Parse annotated text
   *
   * Make sure you call this method only for elements where `this.isParagraphish(elements) === true`
   */
  this.annotatedText = function(state, el, path, options) {
    options = options || {};
    state.contexts.push({
      path: path
    });
    var childIterator = new HTMLConverter.ChildNodeIterator(el);
    var text = this._annotatedText(state, childIterator, options.offset || 0);
    state.contexts.pop();
    return text;
  };

  // Internal function for parsing annotated text
  // --------------------------------------------
  //
  this._annotatedText = function(state, iterator, charPos) {
    var plainText = "";
    if (charPos === undefined) {
      charPos = 0;
    }
    while(iterator.hasNext()) {
      var el = iterator.next();
      var type = this.getNodeType(el);
      // Plain text nodes...
      if (el.nodeType === window.Document.TEXT_NODE) {
        var text = this._prepareText(state, el.textContent);
        plainText = plainText.concat(text);
        charPos += text.length;
      } else if (el.nodeType === window.Document.COMMENT_NODE) {
        // skip comment nodes
        continue;
      } else if (_isTopLevel(type)) {
        iterator.back();
        break;
      }
      // Other...
      else {
        if ( !state.skipTypes[type] ) {
          var start = charPos;
          // recurse into the annotation element to collect nested annotations
          // and the contained plain text
          var childIterator = new HTMLConverter.ChildNodeIterator(el);
          var annotatedText = this._annotatedText(state, childIterator, charPos, "nested");

          plainText = plainText.concat(annotatedText);
          charPos += annotatedText.length;

          if (this.isAnnotation(type) && !state.ignoreAnnotations) {
            this.createAnnotation(state, el, start, charPos);
          }
        }
      }
    }
    return plainText;
  };

  this.getNodeType = function(el) {
    if (el.nodeType === window.Document.TEXT_NODE) {
      return "text";
    } else if (el.nodeType === window.Document.COMMENT_NODE) {
      return "comment";
    } else if (el.tagName) {
      return el.tagName.toLowerCase();
    } else {
      throw new Error("Unknown node type");
    }
  };

  var _annotationTypes = {
    "b": "strong",
    "i": "emphasis",
  };

  this.isAnnotation = function(type) {
    return !!_annotationTypes[type];
  };

  this.createAnnotation = function(state, el, start, end) {
    var context = _.last(state.contexts);
    if (!context || !context.path) {
      throw new Error('Illegal state: context for annotation is required.');
    }
    var type = _annotationTypes[this.getNodeType(el)];
    var data = {
      id: el.id || util.uuid(type),
      type: type,
      path: _.clone(context.path),
      range: [start, end],
    };
    state.annotations.push(data);
  };

  var WS_LEFT = /^\s+/g;
  var WS_LEFT_ALL = /^\s*/g;
  var WS_RIGHT = /\s+$/g;
  var WS_ALL = /\s+/g;
  // var ALL_WS_NOTSPACE_LEFT = /^[\t\n]+/g;
  // var ALL_WS_NOTSPACE_RIGHT = /[\t\n]+$/g;
  var SPACE = " ";
  var TABS_OR_NL = /[\t\n\r]+/g;

  this._prepareText = function(state, text) {
    if (!state.trimWhitespaces) {
      return text;
    }
    // EXPERIMENTAL: drop all 'formatting' white-spaces (e.g., tabs and new lines)
    // (instead of doing so only at the left and right end)
    //text = text.replace(ALL_WS_NOTSPACE_LEFT, "");
    //text = text.replace(ALL_WS_NOTSPACE_RIGHT, "");
    text = text.replace(TABS_OR_NL, "");
    if (state.lastChar === SPACE) {
      text = text.replace(WS_LEFT_ALL, "");
    } else {
      text = text.replace(WS_LEFT, SPACE);
    }
    text = text.replace(WS_RIGHT, SPACE);
    // EXPERIMENTAL: also remove white-space within
    if (this.options.REMOVE_INNER_WS) {
      text = text.replace(WS_ALL, SPACE);
    }
    state.lastChar = text[text.length-1] || state.lastChar;
    return text;
  };

};
HTMLConverter.prototype = new HTMLConverter.Prototype();

HTMLConverter.ChildNodeIterator = function(arg) {
  this.nodes = arg.childNodes;
  this.length = this.nodes.length;
  this.pos = -1;
};

HTMLConverter.ChildNodeIterator.Prototype = function() {
  this.hasNext = function() {
    return this.pos < this.length - 1;
  };
  this.next = function() {
    this.pos += 1;
    return this.nodes[this.pos];
  };
  this.back = function() {
    if (this.pos >= 0) {
      this.pos -= 1;
    }
    return this;
  };
};
HTMLConverter.ChildNodeIterator.prototype = new HTMLConverter.ChildNodeIterator.Prototype();

module.exports = HTMLConverter;
