var express = require('express'),
    app = express(),
    converter = require('./server.js'),
    urlparser = require("url"),
    Document = require('substance-document');

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
});

app.get('/', function(req, res) {
  res.render('playground');
});

app.post('/tosubstance', function(req, res) {
  converter.toSubstance(req.body.url, req.body.syntax, req.body.id,function(err,result){
    res.json(result);
	});
});

app.post('/fromsubstance', function(req, res) {
  var parts = urlparser.parse(req.body.url),
      protocol;
  if (parts.protocol === 'http:'){
    protocol = require('http');
  } else if(parts.protocol === 'https:') {
    protocol = require('https');
  }
  protocol.get(req.body.url, function(result) {
    var body = '';
    result.on('data', function(chunk) {
      body += chunk;
    });
    result.on('end', function() {
      var json = JSON.parse(body),
          doc = Document.fromSnapshot(json);
      converter.fromSubstance(doc,req.body.syntax,function(err,resp) {
        res.send(resp);
      });
    });
  }).on('error', function(e) {
    console.log("Got error: ", e);
	});
});

app.get('/demo', function(req, res) {
  var url = "https://dl.dropboxusercontent.com/u/606131/lens-intro.md";
  converter.toSubstance(url, 'markdown', 'my-doc', function(err,doc) {
    res.json(doc.toJSON());
  });
});

app.listen(process.env.PORT || 5001);