"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var NLMImporter = require('../src/nlm_importer');
var fs = require("substance-util/src/fs");
var Data = require("substance-data");

// Test
// ========

var NLMImporterTest = function () {

  this.setup = function() {
    this.importer = new NLMImporter();
  };

  this.importFixture = function(path, cb) {
    fs.readFile(__dirname, path, {encoding: "utf8"}, function(err, data) {
      if (err) return cb(err);
      try {
        this.doc = this.importer.import(data);
        this.annotations = new Data.Graph.Index(this.doc, {
          types: ["annotation"],
          property: "path"
        });
        cb(null);
      } catch (err) {
        cb(err);
      }
    }, this);
  };

  this.actions = [
    // Note: every test is split up into two steps Import and Check
    // to keep the assertion checks outside the asynchronous call to load the data

    "Import: Article with Front only", function(cb) {
      this.importFixture("../data/nlm/simple_front.xml", cb);
    },

    "Check: Article with Front only", function() {
      assert.isEqual("simple_front", this.doc.id);
      assert.isEqual("This is a Test Article", this.doc.title);
      assert.isEqual("Tine Testa", this.doc.creator);
      assert.isEqual("This is a test document having no body and a very simple front matter only.", this.doc.abstract);
      assert.isEqual(new Date(2013, 8, 28).getTime(), this.doc.created_at.getTime());
    },

    "Import: Article with a single paragraph", function(cb) {
      this.importFixture("../data/nlm/single_paragraph.xml", cb);
    },

    "Check: Article with a single paragraph", function() {
      var p1 = this.doc.get("paragraph_1");
      assert.isDefined(p1);
      assert.isEqual("This is a Paragraph.", p1.content);
      assert.isArrayEqual(["paragraph_1"], this.doc.get("content").nodes);
    },

    "Import: Article with single section", function(cb) {
      this.importFixture("../data/nlm/single_section.xml", cb);
    },

    "Check: Article with single section", function() {
      var h1 = this.doc.get("heading_1");
      var p1 = this.doc.get("paragraph_1");
      assert.isDefined(h1);
      assert.isDefined(p1);
      assert.isEqual("Level-1 Heading", h1.content);
      assert.isEqual(1, h1.level);
      assert.isEqual("This is a Paragraph.", p1.content);
      assert.isArrayEqual(["heading_1", "paragraph_1"], this.doc.get("content").nodes);
    },

    "Import: Article with nested sections", function(cb) {
      this.importFixture("../data/nlm/nested_section.xml", cb);
    },

    "Check: Article with nested sections", function() {
      var h1 = this.doc.get("heading_1");
      var p1 = this.doc.get("paragraph_1");
      var h2 = this.doc.get("heading_2");
      var p2 = this.doc.get("paragraph_2");
      assert.isDefined(h1);
      assert.isDefined(p1);
      assert.isDefined(h2);
      assert.isDefined(p2);
      assert.isEqual("Level-1 Heading", h1.content);
      assert.isEqual(1, h1.level);
      assert.isEqual("This is a Paragraph.", p1.content);
      assert.isEqual("Level-2 Heading", h2.content);
      assert.isEqual(2, h2.level);
      assert.isEqual("Another Paragraph.", p2.content);
      assert.isArrayEqual(["heading_1", "paragraph_1", "heading_2", "paragraph_2"], this.doc.get("content").nodes);
    },

    "Import: Annotated paragraph", function(cb) {
      this.importFixture("../data/nlm/annotated_paragraph.xml", cb);
    },

    "Check: Annotated paragraph", function() {
      var p1 = this.doc.get("paragraph_1");
      var p2 = this.doc.get("paragraph_2");
      var p3 = this.doc.get("paragraph_3");
      var p4 = this.doc.get("paragraph_4");

      assert.isDefined(p1);
      assert.isDefined(p2);
      assert.isDefined(p3);
      assert.isDefined(p4);

      var e1 = this.doc.get("emphasis_1");
      var s1 = this.doc.get("strong_1");
      var i1 = this.doc.get("idea_1");
      var i2 = this.doc.get("idea_2");
      var s2 = this.doc.get("strong_2");

      assert.isDefined(e1);
      assert.isDefined(s1);
      assert.isDefined(i1);
      assert.isDefined(i2);
      assert.isDefined(s2);

      assert.isEqual("This is emphasised.", p1.content);
      assert.isEqual("This is a strong emphasis.", p2.content);
      assert.isEqual("This is a reference.", p3.content);
      assert.isEqual("This is a nested annotation.", p4.content);

      assert.isArrayEqual([8, 18], e1.range);
      assert.isArrayEqual([10, 16], s1.range);
      assert.isArrayEqual([10, 19], i1.range);
      assert.isArrayEqual([17, 27], i2.range);
      assert.isArrayEqual([17, 21], s2.range);
    },

    "Import: A Figure", function(cb) {
      this.importFixture("../data/nlm/figures.xml", cb);
    },

    "Check: A Figure", function() {
      var fig = this.doc.get("figure_1");
      var img = this.doc.get("image_1");
      var caption = this.doc.get("paragraph_2");

      assert.isDefined(fig);
      assert.isDefined(img);
      assert.isDefined(caption);

      assert.isEqual(img.id, fig.image);
      assert.isEqual(caption.id, fig.caption);
      assert.isEqual("http://foo.bar/bla.tif", img.url);
      assert.isEqual("This is a caption", caption.content);
    },

    "Import: A Paragraph With Figure", function(cb) {
      this.importFixture("../data/nlm/paragraph_with_figure.xml", cb);
    },

    "Check: The Figure should break the Paragraph", function() {
      var p = this.doc.get("paragraph_1");
      var fig = this.doc.get("figure_1");

      assert.isDefined(p);
      assert.isDefined(fig);

      assert.isEqual("This is a Paragraph with a Figure:", p.content);
    },

  ];
};

registerTest(['Converter', 'NLMImporter'], new NLMImporterTest());
