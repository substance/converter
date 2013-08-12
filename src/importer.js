"use strict";

var util = require("substance-util");
var errors = util.errors;
var Article = require("substance-article");

var ImporterError = errors.define("ImporterError");

var Importer = function() {
};

Importer.Prototype = function() {

  this.import = function(input) {
    var state = {};

    // an id generator for different types
    var ids = {};
    state.nextId = function(type) {
      ids[type] = ids[type] || 0;
      ids[type]++;
      return type +"_"+ids[type];
    };

    state.input = input;

    return this.document(state, input);
  };

  this.document = function(state, input) {
    var meta = input[0];
    var doc = new Article({"id": meta.doc_id});

    state.doc = doc;

    // all nodes on this level are inserted and shown
    var nodes = input[1];
    for (var i = 0; i < nodes.length; i++) {
      var node = this.topLevelNode(state, nodes[i]);
      doc.show("content", node.id, i);
    }

    return doc;
  };

  this.topLevelNode = function(state, input) {
    var type = Object.keys(input)[0];

    switch(type) {
      case "Header":
        return this.header(state, input["Header"]);
      case "Para":
        return this.paragraph(state, input["Para"]);
      default:
        throw new ImporterError("Node not supported: "+type);
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
    var content = this.text(state, input[2]);

    var id = state.nextId("header");
    var node = {
      id: id,
      type: "heading",
      level: level,
      content: content
    };
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
    var content = this.text(state, input);

    var id = state.nextId("paragraph");
    var node = {
      id: id,
      type: "paragraph",
      content: content
    };
    return doc.create(node);
  };

  // Retrieves a text block from an array of textish fragments
  // and creates annotations on the fly.
  // --------
  //

  this.text = function(state, textFragments) {
    var result = [];
    for (var i = 0; i < textFragments.length; i++) {
      var item = textFragments[i];

      if (item === "Space") {
        result.push(" ");
      }
      else if (item["Str"] !== undefined) {
        result.push(item["Str"]);
      }
      else {
        throw new ImporterError("Unsupported fragment for textish: " + item);
      }
    }

    return result.join("");
  };

};

Importer.prototype = new Importer.Prototype();
Importer.ImporterError = ImporterError;

module.exports = Importer;
