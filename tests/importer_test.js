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
      var annotationIndex = Annotator.createIndex(doc);

      var p1 = doc.get("paragraph_1");
      assert.isDefined(p1);

      assert.isEqual("I am an annotated paragraph.", p1.content);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);

      var annotations = annotationIndex.get("paragraph_1");
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
      var annotationIndex = Annotator.createIndex(doc);
      var annotations = annotationIndex.get();

      var p = doc.get("paragraph_1");
      var link = annotations["link_1"];

      assert.isDefined(p);
      assert.isDefined(link);
      assert.isEqual("link", link.type);

      assert.isEqual("This is an example inline link.", p.content);
      assert.isArrayEqual(["paragraph_1", "content"], link.path);
      assert.isArrayEqual([8, 18], link.range);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);
    },

    "Inline code is an annotation.", function() {
      var input = require("../data/inline_code.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);
      var annotations = annotationIndex.get();

      var p = doc.get("paragraph_1");
      var code = annotations["code_1"];

      assert.isDefined(p);
      assert.isDefined(code);
      assert.isEqual("code", code.type);

      assert.isEqual("Don't call me foo(), fool", p.content);
      assert.isArrayEqual(["paragraph_1", "content"], code.path);
      assert.isArrayEqual([14, 19], code.range);
      assert.isArrayEqual(["paragraph_1"], doc.get("content").nodes);
    },

    "Paragraph with Image and caption.", function() {
      var input = require("../data/paragraph_and_image.json");

      var doc = this.importer.import(input);

      var p1 = doc.get("paragraph_1");
      var img = doc.get("image_1");
      var caption = doc.get("caption_1");
      var p2 = doc.get("paragraph_2");

      assert.isDefined(p1);
      assert.isDefined(img);
      assert.isDefined(p2);

      assert.isEqual("This is paragraph 1.", p1.content);
      assert.isEqual("http://backbonejs.org/docs/images/lens.png", img.url);
      assert.isEqual("This is paragraph 2.", p2.content);
      assert.isEqual(img.caption.id, caption.id);
      assert.isEqual("lens", caption.content);
      assert.isArrayEqual(["paragraph_1", "image_1", "paragraph_2"], doc.get("content").nodes);
    },

    "Annotated List", function() {
      var input = require("../data/annotated_list.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);

      var l1 = doc.get("list_1");
      var annotations = annotationIndex.get();

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
    },

    "Annotations in Nested Blockquotes", function() {
      var input = require("../data/nested_block_quotes_with_annotations.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);

      var p1 = doc.get("paragraph_1");
      var p2 = doc.get("paragraph_2");
      var p3 = doc.get("paragraph_3");
      var p4 = doc.get("paragraph_4");

      var annotations = annotationIndex.get();
      var e1 = annotations["emphasis_1"];
      var s1 = annotations["strong_1"];
      var e2 = annotations["emphasis_2"];
      var e3 = annotations["emphasis_3"];

      assert.isDefined(p1);
      assert.isDefined(p2);
      assert.isDefined(p3);
      assert.isDefined(p4);
      assert.isDefined(e1);
      assert.isDefined(s1);
      assert.isDefined(e2);
      assert.isDefined(e3);

      assert.isEqual("This is the first level of quoting.", p1.content);
      assert.isEqual("This is nested blockquote.", p2.content);
      assert.isEqual("And a another level is here.", p3.content);
      assert.isEqual("Back to the first level.", p4.content);
      assert.isArrayEqual(["paragraph_1", "content"], e1.path);
      assert.isArrayEqual([18, 23], e1.range);
      assert.isArrayEqual(["paragraph_2", "content"], s1.path);
      assert.isArrayEqual([15, 25], s1.range);
      assert.isArrayEqual(["paragraph_3", "content"], e2.path);
      assert.isArrayEqual([6, 13], e2.range);
      assert.isArrayEqual(["paragraph_4", "content"], e3.path);
      assert.isArrayEqual([12, 17], e3.range);
    },

    "Convert eLife Lens REAMDE", function() {
      var input = require("../data/lens_readme.json");
      //console.log("MEEH", input);
      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);
      var annotations = annotationIndex.get();

      // Document elements
      var expected_nodes = ["header_1","codeblock_1","paragraph_1","paragraph_2","header_2","paragraph_3","paragraph_4","header_3","list_1","paragraph_6","list_2","paragraph_8","list_3","paragraph_10","list_4","paragraph_12","header_4","paragraph_13","paragraph_14","paragraph_15","paragraph_16","paragraph_17","paragraph_18","header_5","paragraph_19","paragraph_20","paragraph_21","codeblock_2","paragraph_22","header_6","codeblock_3","header_7","paragraph_23","codeblock_4","paragraph_24","header_8","paragraph_25"];
      var actual_nodes = doc.get("content").nodes;

      // All inline-code annotations at the right place?
      var c1 = annotations["code_1"];
      var c2 = annotations["code_2"];
      var c3 = annotations["code_3"];
      var c4 = annotations["code_4"];
      var c5 = annotations["code_5"];
      var c6 = annotations["code_6"];
      var c7 = annotations["code_7"];

      assert.isArrayEqual(["paragraph_6", "content"],c1.path);
      assert.isArrayEqual([0, 118], c1.range);
      assert.isArrayEqual(["paragraph_8", "content"],c2.path);
      assert.isArrayEqual([0, 61], c2.range);
      assert.isArrayEqual(["paragraph_10", "content"],c3.path);
      assert.isArrayEqual([0, 41], c3.range);
      assert.isArrayEqual(["paragraph_11", "content"],c4.path);
      assert.isArrayEqual([51, 72], c4.range);
      assert.isArrayEqual(["paragraph_12", "content"],c5.path);
      assert.isArrayEqual([0, 19], c5.range);
      assert.isArrayEqual(["paragraph_21", "content"],c6.path);
      assert.isArrayEqual([32, 44], c6.range);
      assert.isArrayEqual(["paragraph_24", "content"],c7.path);
      assert.isArrayEqual([13, 17], c7.range);
      assert.isArrayEqual([13, 17], c7.range);
      assert.isArrayEqual(expected_nodes, actual_nodes);
    },
  ];
};

registerTest(['Converter', 'Importer'], new ImporterTest());
