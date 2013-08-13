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
      var h2 = doc.get("header_2");
      var h3 = doc.get("header_3");

      assert.isDefined(h1);
      assert.isDefined(p1);
      assert.isDefined(h2);
      assert.isDefined(h3);

      assert.isEqual("Heading", h1.content);
      assert.isEqual("And a paragraph", p1.content);
      assert.isEqual(1, h1.level);
      assert.isEqual(2, h2.level);
      assert.isEqual(3, h3.level);
      assert.isArrayEqual(["header_1", "paragraph_1", "header_2", "header_3"], doc.get("content").nodes);
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

    "List", function() {
      var input = require("../data/list.json");

      var doc = this.importer.import(input);
      var l1 = doc.get("list_1");
      var items = l1.items;
      assert.isDefined(l1);
      assert.isEqual(3, items.length);
      assert.isEqual("I am a listitem", items[0].content);
      assert.isEqual("Me too", items[1].content);
      assert.isEqual("Me three", items[2].content);
    },

    "Paragraph and List", function() {
      var input = require("../data/paragraph_and_list.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("paragraph_1");
      var l1 = doc.get("list_1");
      var items = l1.items;

      assert.isDefined(p1);
      assert.isDefined(l1);
      assert.isEqual(3, items.length);

      assert.isEqual("I am a paragraph", p1.content);
      assert.isEqual("List item 1", items[0].content);
      assert.isEqual("List item 2", items[1].content);
      assert.isEqual("List item 3", items[2].content);
    },

    "Blockquotes are flattened into Paragraphs (for now)", function() {
      var input = require("../data/block_quote.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("paragraph_1");
      var p2 = doc.get("paragraph_2");

      assert.isEqual("This is a blockquote", p1.content);
      assert.isEqual("...with two paragraphs.", p2.content);
      assert.isArrayEqual(["paragraph_1", "paragraph_2"], doc.get("content").nodes);
    },

    "Even nested Blockquotes are flattened.", function() {
      var input = require("../data/nested_block_quotes.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("paragraph_1");
      var p2 = doc.get("paragraph_2");
      var p3 = doc.get("paragraph_3");

      assert.isEqual("This is the first level of quoting.", p1.content);
      assert.isEqual("This is nested blockquote.", p2.content);
      assert.isEqual("Back to the first level.", p3.content);
      assert.isArrayEqual(["paragraph_1", "paragraph_2", "paragraph_3"], doc.get("content").nodes);
    },

    "Codeblock", function() {
      var input = require("../data/paragraph_and_codeblock.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("paragraph_1");
      var c1 = doc.get("codeblock_1");

      assert.isEqual("This is a normal paragraph:", p1.content);
      assert.isEqual("function foo() {\n  returb \"bar\";\n}", c1.content);
      assert.isArrayEqual(["paragraph_1", "codeblock_1"], doc.get("content").nodes);
    },

    "Horitontal rulers are ignored.", function() {
      var input = require("../data/horizontal_ruler.json");
      var doc = this.importer.import(input);
      assert.isArrayEqual(["paragraph_1", "paragraph_2"], doc.get("content").nodes);
    },

    "Links are annotations.", function() {
      var input = require("../data/inline_link.json");

      var doc = this.importer.import(input);
      var annotator = new Annotator(doc);
      var annotations = annotator.getAnnotations();

      var p = doc.get("paragraph_1");
      var link = annotation.get("link_1");

      assert.isDefined(p);
      assert.isDefined(link);
      assert.isEqual("link", link.type);

      assert.isEqual("This is an example inline link", p1.content);
      assert.isArrayEqual(["paragraph_1", "content"], link.path);
      assert.isArrayEqual([8, 18], link.range);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);
    },

    "Inline code is an annotation." function() {
      var input = require("../data/inline_code.json");

      var doc = this.importer.import(input);
      var annotator = new Annotator(doc);
      var annotations = annotator.getAnnotations();

      var p = doc.get("paragraph_1");
      var code = annotation.get("code_1");

      assert.isDefined(p);
      assert.isDefined(code);
      assert.isEqual("code", code.type);

      assert.isEqual("Don't call me foo(), fool", p1.content);
      assert.isArrayEqual(["paragraph_1", "content"], code.path);
      assert.isArrayEqual([14, 19], code.range);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);
    },

    "Annotated List", function() {
      var input = require("../data/annotated_list.json");

      var doc = this.importer.import(input);
      var annotator = new Annotator(doc);

      var l1 = doc.get("list_1");
      var annotations = annotator.getAnnotations();

      assert.isDefined(l1);
      assert.isDefined(doc.get("paragraph_1"));
      assert.isDefined(doc.get("paragraph_2"));
      assert.isDefined(doc.get("paragraph_3"));
      assert.isDefined(annotations["emphasis_1"]);
      assert.isDefined(annotations["strong_1"]);

      var p1 = doc.get("paragraph_1");
      var p2 = doc.get("paragraph_2");
      var p3 = doc.get("paragraph_3");
      var e1 = annotations["emphasis_1"];
      var s1 = annotations["strong_1"];

      assert.isEqual("I am a listitem", p1.content);
      assert.isEqual("Me too", p2.content);
      assert.isEqual("Me three", p3.content);
      assert.isArrayEqual(["paragraph_2", "content"], e1.path);
      assert.isArrayEqual([3, 6], e1.range);
      assert.isArrayEqual(["paragraph_3", "content"], s1.path);
      assert.isArrayEqual([3, 8], s1.range);
    }

  ];
};

registerTest(['Converter', 'Importer'], new ImporterTest());
