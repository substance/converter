"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Exporter = require('../src/importer');

// Test
// ========

var ExporterTest = function () {

  this.setup = function() {

  };

  this.actions = [

    "Start over", function() {
      
    }
  ];
};

registerTest(['Converter', 'Exporter'], new ExporterTest());
