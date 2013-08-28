"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var NLMImporter = require('../src/nlm_importer');
var fs = require("substance-util/src/fs");

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
      assert.isEqual("Foo Bar", this.doc.creator);
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

  ];
};

registerTest(['Converter', 'NLMImporter'], new NLMImporterTest());
