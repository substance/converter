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
    }

  ];
};

registerTest(['Converter', 'Exporter'], new ExporterTest());
