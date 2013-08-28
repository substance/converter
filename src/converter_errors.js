var util = require("substance-util");
var _ = require("underscore");
var errors = util.errors;

var ImporterError = errors.define("ImporterError");
var ExporterError = errors.define("ExporterError");

module.exports = {
  ImporterError: ImporterError,
  ExporterError: ExporterError
};
