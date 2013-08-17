"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Importer = require('../src/importer');
var Exporter = require('../src/exporter');

// Test
// ========

var ExporterTest = function () {

  this.setup = function() {
    this.importer = new Importer();
    this.exporter = new Exporter();
  };

  this.actions = [

    "Paragraph and Heading", function() {
      var expected = require("../data/heading_and_paragraph.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "Annotated Paragraph", function() {
      var expected = require("../data/annotated_paragraph.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "List", function() {
      var expected = require("../data/list.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "Paragraph and List", function() {
      var expected = require("../data/paragraph_and_list.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },
    
    "Codeblock", function() {
      var expected = require("../data/paragraph_and_codeblock.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },
    
    "Links", function() {
      var expected = require("../data/inline_link.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "Inline code", function() {
      var expected = require("../data/inline_code.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "Paragraph with Image and caption", function() {
      var expected = require("../data/paragraph_and_image.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    },

    "Annotated List", function() {
      var expected = require("../data/annotated_list.json");

      var doc = this.importer.import(expected);
      var actual = this.exporter.export(doc);

      assert.isDeepEqual(expected[1], actual[1]);
    }
  ];
};

registerTest(['Converter', 'Exporter'], new ExporterTest());
