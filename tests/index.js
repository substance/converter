"use strict";

// PandocImporter
// ---------------

require("./pandoc_importer_test");
require("./pandoc_exporter_test");

// NLMImporter
// ---------------
// Until we do not have a means to parse the XML on node.js
// the NLM importer is only available in the browser

if (global.window) {
  require("./nlm_importer_test");
}
