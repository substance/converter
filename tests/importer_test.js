"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Importer = require('../src/importer');
var Document = require("substance-document");
var Annotator = Document.Annotator;

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
      assert.isArrayEqual(["header_1", "paragraph_1"], doc.get("content").nodes);
    },

    "Annotated Paragraph", function() {
      var input = require("../data/annotated_paragraph.json");

      var doc = this.importer.import(input);
      var annotator = new Annotator(doc);

      var p1 = doc.get("paragraph_1");

      assert.isDefined(p1);

      assert.isEqual("I am an annotated paragraph.", p1.content);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);

      var annotations = annotator.getAnnotations({node: "paragraph_1"});
      assert.isDefined(annotations["emphasis_1"]);
      assert.isDefined(annotations["strong_1"]);

      assert.isArrayEqual(["paragraph_1", "content"], annotations["emphasis_1"].path);
      assert.isArrayEqual([8, 17], annotations["emphasis_1"].range);
    },
    }
  ];
};

registerTest(['Converter', 'Importer'], new ImporterTest());
