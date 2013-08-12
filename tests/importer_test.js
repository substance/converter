"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Importer = require('../src/importer');

// Test
// ========

var ImporterTest = function () {

  this.setup = function() {
    this.importer = new Importer();
  };

  this.actions = [

    "Heading and Paragraph", function() {
      var input = require("../data/heading_and_paragraph.json");

      var doc = this.importer.import(input);

      var h1 = doc.get("header_1");
      var p1 = doc.get("paragraph_1");

      assert.isDefined(h1);
      assert.isDefined(p1);

      assert.isEqual("Heading", h1.content);
      assert.isEqual("And a paragraph", p1.content);
    }
  ];
};

registerTest(['Converter', 'Importer'], new ImporterTest());
