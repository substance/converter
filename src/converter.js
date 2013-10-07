"use strict";

var PandocImporter = require('./pandoc_importer');
var PandocExporter = require('./pandoc_exporter');
var errors = require("./converter_errors");
var spawn = require('child_process').spawn;
var util = require("substance-util");

// Serves a Converter
// ========
//

var Converter = function() {
  
};

Converter.Prototype = function() {

  // Run Pandoc
  // --------
  //

  this.pandoc = function(input,from,to,cb) {
    var args = [ '-f', from, '-t', to],
        result = '',
        error = '',
        child;

    // Checks if the pandoc tool is available
    function __pandocAvailable(cb) {
      var test = spawn('pandoc', ['--help']);
      test.on('error', function() {
        console.error('Pandoc not found');
        cb('Pandoc not found');
      });
      test.on('exit', function() { cb(null); });
      test.stdin.end();
    }

    __pandocAvailable(function(err) {
      if (err) return cb(err);

      child = spawn('pandoc',args);

      child.on('error', function(err) { cb(err); });

      child.stdout.on('data', function (data) {
        result += data;
      });

      child.stderr.on('data', function (data) {
        error += data;
      });

      child.on('exit', function (code) {
        if (code !== 0)
          return cb(new Error('pandoc exited with code ' + code + '.'));
        if (error)
          return cb(new Error(error));
        cb(null, result);
      });

      child.stdin.write(input, 'utf8');
      child.stdin.end();
    });
  };


  // Takes input data as a string
  // --------
  //
  // Format "json" corresponds to Pandoc JSON format

  this.convert = function(input, inputFormat, outputFormat, cb) {
    var that = this;

    var converter;
    if (inputFormat === "json" && outputFormat === "substance") {
      try {
        converter = new PandocImporter();
        cb(null, converter.import(JSON.parse(input)));
      } catch(err) {
        util.printStackTrace(err);
        cb(err);
      }
    } else if(inputFormat === "substance") {
      converter = new PandocExporter();
      var json = converter.export(input);
      this.pandoc(JSON.stringify(json), 'json', 'html', function(err, result) {
        if (err) return cb(err);
        return cb(null, result);
      });
    } else {

      // Any input format that can be processed by Pandoc
      // --------

      // If substance is the target format first run pandoc with json output

      var pandocOutputFormat = outputFormat === "substance" ? "json" : outputFormat;
      that.pandoc(input, inputFormat, pandocOutputFormat, function(err, result) {
        if (err) return cb(err);
        if (outputFormat !== "substance") return cb(null, result);

        // Final step to the get Substance out of it.
        that.convert(result, "json", "substance", cb);
      });
    }
  };
};

// currently not supported under node.js as we use the DOM for XML parsing

Converter.ImporterError = errors.ImporterError;
Converter.ExporterError = errors.ExporterError;
Converter.PandocImporter = PandocImporter;
Converter.PandocExporter = PandocExporter;

if (global.window) {
  Converter.NLMImporter = require("./nlm_importer");
}

Converter.prototype = new Converter.Prototype();

module.exports = Converter;
