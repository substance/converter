"use strict";

// Import
// ========

var _ = require("underscore");
var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Importer = require('../src/pandoc_importer');
var Document = require("substance-document");
var Annotator = Document.Annotator;

// Test
// ========

function getIdGenerator() {
  // an id generator for different types
  var ids = {};
  return function(type) {
    ids[type] = ids[type] || 0;
    ids[type]++;
    return type +"_"+ids[type];
  };
}

var PandocImporterTest = function () {

  this.setup = function() {
    this.importer = new Importer();
  };

  this.actions = [

    "Heading and Paragraph", function() {
      var input = require("../data/pandoc/heading_and_paragraph.json");

      var doc = this.importer.import(input);

      var h1 = doc.get("header_1");
      var p1 = doc.get("text_1");
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
      assert.isArrayEqual(["header_1", "text_1", "header_2", "header_3"], doc.get("content").nodes);
    },

    "Annotated Paragraph", function() {
      var input = require("../data/pandoc/annotated_paragraph.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);

      var p1 = doc.get("text_1");
      assert.isDefined(p1);

      assert.isEqual("I am an annotated paragraph.", p1.content);
      assert.isArrayEqual(["text_1"], doc.get("content").nodes);

      var annotations = annotationIndex.get("text_1");
      assert.isDefined(annotations["emphasis_1"]);
      assert.isDefined(annotations["strong_1"]);

      assert.isArrayEqual(["text_1", "content"], annotations["emphasis_1"].path);
      assert.isArrayEqual([8, 17], annotations["emphasis_1"].range);
    },

    "List", function() {
      var input = require("../data/pandoc/list.json");

      var doc = this.importer.import(input);
      var l1 = doc.get("list_1");
      var items = l1.getItems();

      assert.isDefined(l1);
      assert.isEqual(3, items.length);
      assert.isEqual("I am a listitem", items[0].content);
      assert.isEqual("Me too", items[1].content);
      assert.isEqual("Me three", items[2].content);
    },

    "Paragraph and List", function() {
      var input = require("../data/pandoc/paragraph_and_list.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("text_1");
      var l1 = doc.get("list_1");
      var items = l1.getItems();

      assert.isDefined(p1);
      assert.isDefined(l1);
      assert.isEqual(3, items.length);

      assert.isEqual("I am a paragraph", p1.content);
      assert.isEqual("List item 1", items[0].content);
      assert.isEqual("List item 2", items[1].content);
      assert.isEqual("List item 3", items[2].content);
    },

    "Blockquotes are flattened into Paragraphs (for now)", function() {
      var input = require("../data/pandoc/block_quote.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("text_1");
      var p2 = doc.get("text_2");

      assert.isEqual("This is a blockquote", p1.content);
      assert.isEqual("...with two paragraphs.", p2.content);
      assert.isArrayEqual(["text_1", "text_2"], doc.get("content").nodes);
    },

    "Even nested Blockquotes are flattened.", function() {
      var input = require("../data/pandoc/nested_block_quotes.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("text_1");
      var p2 = doc.get("text_2");
      var p3 = doc.get("text_3");

      assert.isEqual("This is the first level of quoting.", p1.content);
      assert.isEqual("This is nested blockquote.", p2.content);
      assert.isEqual("Back to the first level.", p3.content);
      assert.isArrayEqual(["text_1", "text_2", "text_3"], doc.get("content").nodes);
    },

    "Codeblock", function() {
      var input = require("../data/pandoc/paragraph_and_codeblock.json");

      var doc = this.importer.import(input);
      var p1 = doc.get("text_1");
      var c1 = doc.get("codeblock_1");

      assert.isEqual("This is a normal paragraph:", p1.content);
      assert.isEqual("function foo() {\n  returb \"bar\";\n}", c1.content);
      assert.isArrayEqual(["text_1", "codeblock_1"], doc.get("content").nodes);
    },

    "Horizontal rulers are ignored.", function() {
      var input = require("../data/pandoc/horizontal_ruler.json");
      var doc = this.importer.import(input);
      assert.isArrayEqual(["text_1", "text_2"], doc.get("content").nodes);
    },

    "Links are annotations.", function() {
      var input = require("../data/pandoc/inline_link.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);
      var annotations = annotationIndex.get();

      var p = doc.get("text_1");
      var link = annotations["link_1"];

      assert.isDefined(p);
      assert.isDefined(link);
      assert.isEqual("link", link.type);

      assert.isEqual("This is an example inline link.", p.content);
      assert.isArrayEqual(["text_1", "content"], link.path);
      assert.isArrayEqual([8, 18], link.range);
      assert.isArrayEqual(["text_1"], doc.get("content").nodes);
    },

    "Inline code is an annotation.", function() {
      var input = require("../data/pandoc/inline_code.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);
      var annotations = annotationIndex.get();

      var p = doc.get("text_1");
      var code = annotations["code_1"];

      assert.isDefined(p);
      assert.isDefined(code);
      assert.isEqual("code", code.type);

      assert.isEqual("Don't call me foo(), fool", p.content);
      assert.isArrayEqual(["text_1", "content"], code.path);
      assert.isArrayEqual([14, 19], code.range);
      assert.isArrayEqual(["text_1"], doc.get("content").nodes);
    },

    "Paragraph with Image.", function() {
      var input = require("../data/pandoc/paragraph_and_image.json");

      var doc = this.importer.import(input);

      var p1 = doc.get("text_1");
      var img = doc.get("figure_1");
      var caption = doc.get("text_2");
      var p2 = doc.get("text_3");


      assert.isDefined(p1);
      assert.isDefined(img);
      assert.isDefined(caption);
      assert.isDefined(p2);

      // TODO: mql removed figures in favor of simple images
      // currently only the url is imported

      assert.isEqual("This is paragraph 1.", p1.content);
      assert.isEqual("http://backbonejs.org/docs/images/lens.png", img.url);
      assert.isEqual("lens", caption.content);
      assert.isEqual("This is paragraph 2.", p2.content);
      assert.isArrayEqual(["text_1", "figure_1", "text_3"], doc.get("content").nodes);
    },

    "Annotated List", function() {
      var input = require("../data/pandoc/annotated_list.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);

      var l1 = doc.get("list_1");
      var annotations = annotationIndex.get();

      assert.isDefined(l1);
      assert.isDefined(doc.get("text_1"));
      assert.isDefined(doc.get("text_2"));
      assert.isDefined(doc.get("text_3"));
      assert.isDefined(annotations["emphasis_1"]);
      assert.isDefined(annotations["strong_1"]);

      var p1 = doc.get("text_1");
      var p2 = doc.get("text_2");
      var p3 = doc.get("text_3");
      var e1 = annotations["emphasis_1"];
      var s1 = annotations["strong_1"];

      assert.isEqual("I am a listitem", p1.content);
      assert.isEqual("Me too", p2.content);
      assert.isEqual("Me three", p3.content);
      assert.isArrayEqual(["text_2", "content"], e1.path);
      assert.isArrayEqual([3, 6], e1.range);
      assert.isArrayEqual(["text_3", "content"], s1.path);
      assert.isArrayEqual([3, 8], s1.range);
    },

    "Annotations in Nested Blockquotes", function() {
      var input = require("../data/pandoc/nested_block_quotes_with_annotations.json");

      var doc = this.importer.import(input);
      var annotationIndex = Annotator.createIndex(doc);

      var p1 = doc.get("text_1");
      var p2 = doc.get("text_2");
      var p3 = doc.get("text_3");
      var p4 = doc.get("text_4");

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
      assert.isArrayEqual(["text_1", "content"], e1.path);
      assert.isArrayEqual([18, 23], e1.range);
      assert.isArrayEqual(["text_2", "content"], s1.path);
      assert.isArrayEqual([15, 25], s1.range);
      assert.isArrayEqual(["text_3", "content"], e2.path);
      assert.isArrayEqual([6, 13], e2.range);
      assert.isArrayEqual(["text_4", "content"], e3.path);
      assert.isArrayEqual([12, 17], e3.range);
    },

    "Document with YAML meta header", function() {
      var input = require("../data/pandoc/with_yaml_meta.json");
      var doc = this.importer.import(input);

      var meta = doc.get(["document", "meta"]);
      var expected = {
        title: "MyDoc",
        author: {
          name: "Mickey Mouse",
          address: {
            street: "The Street 111",
            zip: "123",
            state: "Phantasia"
          }
        },
        keywords: ["yaml","meta"]
      };
      assert.isObjectEqual(expected, meta);
    },

    "Inline formula", function() {
      var input = require("../data/pandoc/inline_math.json");
      var doc = this.importer.import(input);

      var t = doc.get("text_1");
      var m1 = doc.get("math_1");
      var m2 = doc.get("math_2");

      assert.isDefined(t);
      assert.isDefined(m1);
      assert.isDefined(m2);

      assert.isEqual("x^2", m1.getContent());
      assert.isEqual("x", m2.getContent());

      var expected_nodes = ["text_1"];
      assert.isArrayEqual(expected_nodes, doc.get("content").nodes);
    },

    "Equation", function() {
      var input = require("../data/pandoc/math_equation.json");
      var doc = this.importer.import(input);

      var t1 = doc.get("text_1");
      var f1 = doc.get("formula_1");

      assert.isDefined(t1);
      assert.isDefined(f1);

      assert.isEqual("latex", f1.format);
      assert.isFalse(f1.inline);
      assert.isEqual("f(x) = \\sum x_i^2", f1.data);

      var expected_nodes = ["text_1", "formula_1"];
      assert.isArrayEqual(expected_nodes, doc.get("content").nodes);
    },

    "Table", function() {
      var input = require("../data/pandoc/table.json");
      var doc = this.importer.import(input);

      var table = doc.get("table_1");

      var nextId = getIdGenerator();

      assert.isEqual(nextId("text"), table.caption);

      var expectedHeaderIds = [nextId("text"), nextId("text"), nextId("text"), nextId("text")];
      assert.isArrayEqual(expectedHeaderIds, table.headers);
      var headers = _.map(expectedHeaderIds, function(id) { return doc.get(id); });
      assert.isArrayEqual(["Right", "Left", "Center", "Default"], _.map(headers, function(n) { return n.content;}));

      var expectedCellIds = [nextId("text"), nextId("text"), nextId("text"), nextId("text")];
      assert.isArrayEqual(expectedCellIds, table.cells[0]);
      var row1 = _.map(expectedCellIds, function(id) { return doc.get(id); });
      assert.isArrayEqual(["1", "2", "3", "4"], _.map(row1, function(n) { return n.content; }));

      expectedCellIds = [nextId("text"), nextId("text"), nextId("text"), nextId("text")];
      assert.isArrayEqual(expectedCellIds, table.cells[1]);
      var row2 = _.map(expectedCellIds, function(id) { return doc.get(id); });
      assert.isArrayEqual(["5", "6", "7", "8"], _.map(row2, function(n) { return n.content; }));

      expectedCellIds = [nextId("text"), nextId("text"), nextId("text"), nextId("text")];
      assert.isArrayEqual(expectedCellIds, table.cells[2]);
      var row3 = _.map(expectedCellIds, function(id) { return doc.get(id); });
      assert.isArrayEqual(["9", "10", "11", "12"], _.map(row3, function(n) { return n.content; }));

      var expected_nodes = ["table_1"];
      assert.isArrayEqual(expected_nodes, doc.get("content").nodes);
    },

    // Deactivated. Will be reimplemented.
    // "Description list", function() {
    //   var input = require("../data/pandoc/definition_list.json");
    //   var doc = this.importer.import(input);

    //   var d1 = doc.get("description_1");
    //   var d2 = doc.get("description_2");

    //   assert.isDefined(d1);
    //   assert.isDefined(d2);

    //   var b1 = d1.getBody();
    //   var b2 = d2.getBody();

    //   assert.isEqual("Topic 1", d1.topic);
    //   assert.isEqual("This is the first topic.", b1.content);
    //   assert.isEqual("Topic 2", d2.topic);
    //   assert.isEqual("This is the second topic.", b2.content);
    // },

    "Nested Lists", function() {
      var input = require("../data/pandoc/nested_lists.json");
      var doc = this.importer.import(input);

      var l1 = doc.get("list_1");
      var l2 = doc.get("list_2");

      assert.isDefined(l1);
      assert.isDefined(l2);

      assert.isArrayEqual(["text_1", "list_2", "text_4"], l1.items);
      assert.isArrayEqual(["text_2", "text_3"], l2.items);

      var t1 = doc.get("text_1");
      var t2 = doc.get("text_2");
      var t3 = doc.get("text_3");
      var t4 = doc.get("text_4");

      assert.isEqual("Item 1", t1.content);
      assert.isEqual("Item 1.1", t2.content);
      assert.isEqual("Item 1.2", t3.content);
      assert.isEqual("Item 2", t4.content);
    },

    "HTML comments", function() {
      var input = require("../data/pandoc/html_comments.json");
      var doc = this.importer.import(input);

      var t1 = doc.get("text_1");
      assert.isDefined(t1);

      assert.isArrayEqual(["text_1"], doc.get(["content", "nodes"]));
    }
  ];
};

registerTest(['Substance.Converter', 'Pandoc Importer'], new PandocImporterTest());
