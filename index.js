"use strict";

var errors = require("./src/converter_errors");
var PandocImporter = require("./src/pandoc_importer");
var PandocExporter = require("./src/pandoc_exporter");

var exports = {
  ImporterError: errors.ImporterError,
  ExporterError: errors.ExporterError,
  PandocImporter: PandocImporter,
  PandocExporter: PandocExporter,
}

// currently not supported under node.js as we use the DOM for XML parsing
if (global.window) {
  exports.NLMImporter = require("./src/nlm_importer");
  exports.CNXImporter = require("./src/cnx_importer");
}

module.exports = exports;
