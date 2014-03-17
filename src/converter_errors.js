var util = require("substance-util");
var errors = util.errors;

var ImporterError = errors.define("ImporterError");
var ExporterError = errors.define("ExporterError");

module.exports = {
  ImporterError: ImporterError,
  ExporterError: ExporterError
};
