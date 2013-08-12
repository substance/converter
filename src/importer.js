"use strict";

var Importer = function() {
};

Importer.Prototype = function() {

  this.import = function(pandocJSON) {
    var state = {};

    // an id generator for different types
    var ids = {};
    state.nextId = function(type) {
      ids[type] = ids[type] || 0;
      ids[type]++;
      return type +"_"+ids[type];
    };

    state.input = pandocJSON;

    var nodes;

    return this.document(nodes, state);
  };

  this.document = function(nodes, state) {
  };

  this.paragraph = function(paragraphNode, state) {
  };

  this.text = function(textNode, state) {
  };

};

Importer.prototype = new Importer.Prototype();

module.exports = Importer;