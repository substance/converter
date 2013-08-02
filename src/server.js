"use strict";

var Converter = require('./converter');
var urlparser = require("url");
var request = require("request");


// Serves a Converter
// ========
//

var Server = function(app) {
  this.app = app;
};


Server.Prototype = function() {

  // Run Pandoc
  // --------
  //

  this.pandoc = function(input,from,to,cb) {
    var spawn = require('child_process').spawn,
        args = [ '-f', from, '-t', to],
        result = '',
        error = '',
        child;
    child = spawn('pandoc',args);
    child.stdout.on('data', function (data) {
      result += data;
    });
    child.stderr.on('data', function (data) {
      error += data;
    });
    child.on('exit', function (code) {
      if (code != 0)
        return cb(new Error('pandoc exited with code ' + code + '.'));
      if (error)
        return cb(new Error(error));
      cb(null, result);
    });
    child.stdin.write(input, 'utf8');
    child.stdin.end();
  };

  // // Fetching file by this function instead of internal pandoc method
  // // because of pandoc can't fetch files using https protocol
  // function getFile(url, cb) {

  //   var parts = urlparser.parse(url),
  //       protocol;

  //   // quick workaround
  //   // can be done better?
  //   if (parts.protocol === 'http:'){
  //     protocol = require('http');
  //   } else if(parts.protocol === 'https:') {
  //     protocol = require('https');
  //   }

  //   protocol.get(url, function(res) {
  //     var result = "";
  //     res.on('data', function ( d ) {
  //       result += d.toString();
  //     });
  //     res.on('end', function() {
  //       cb(null,result);
  //     });
  //   }).on('error', function( e ) {
  //     cb(err);
  //   });
  // }

  // Fetch a file from the web
  // --------
  //

  this.getFile = function(url, cb) {
    request(url, function (err, res, body) {
      if (err || res.statusCode !== 200) return cb(err || 'Nope');
      cb(null, body);
    });
  };

  // Takes input data as a string
  // --------
  //
  // Format "json" corresponds to Pandoc JSON format

  this.convert = function(input, inputFormat, outputFormat, cb) {
    var that = this;

    if (inputFormat === "json" && outputFormat === "substance") {
      var converter = new Converter(JSON.parse(input), 'converted_document');
      cb(null, converter.convert());
    } else if(inputFormat === "substance") {
      // Substance as an import format
      throw new Error('Soon.');
    } else {

      // Any input format that can be processed by Pandoc
      // --------

      // If subtance is the target format first run pandoc with json output

      var pandocOutputFormat = outputFormat === "substance" ? "json" : outputFormat;
      that.pandoc(input, inputFormat, pandocOutputFormat, function(err, result) {
        if (err) return cb(err);
        if (outputFormat !== "substance") return cb(null, result);

        // Final step to the get Substance out of it.
        that.convert(result, "json", "substance", cb);
      });
    }
  };

  // Serve the Converter API
  // --------
  //
  // Call this from your app to serve the convert through your Express.js instance
  // 

  this.serve = function() {
    var that = this;

      // Should read input and output from the params
    this.app.get("/convert", function(req, res) {
      // Using provided input or defaults
      var url = req.query.url || "http://raw.github.com/michael/documents/master/eventually-consistent.md";
      var inputFormat = req.query.in || "markdown";
      var outputFormat = req.query.out || "substance";

      that.getFile(url, function(err, inputData) {
        that.convert(inputData, inputFormat, outputFormat, function(err, output) {
          if (err) return res.send(500, err);
          res.send(output);
        });
      })
    });
  };
};


Server.prototype = new Server.Prototype();

module.exports = Server;
