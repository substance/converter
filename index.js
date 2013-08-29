"use strict";

var errors = require("./src/converter_errors");
var PandocImporter = require("./src/pandoc_importer");
var PandocExporter = require("./src/pandoc_exporter");

//disabled because of cyclic deps.
//var Server = require("./src/server");

// currently not supported under node.js as we use the DOM for XML parsing
if (global.window) {
  var NLMImporter = require("./src/nlm_importer");
}

module.exports = {
  ImporterError: errors.ImporterError,
  ExporterError: errors.ExporterError,
  PandocImporter: PandocImporter,
  PandocExporter: PandocExporter,
  NLMImporter: NLMImporter,
//  Server: Server
};
