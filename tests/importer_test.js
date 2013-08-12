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

  };

  this.actions = [

    "Start over", function() {
      
    }
  ];
};

registerTest(['Converter', 'Importer'], new ImporterTest());
