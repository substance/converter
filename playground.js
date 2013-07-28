var express = require('express'),
    app = express(),
    toSubstance = require('./server.js');

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
});    
var url = 'https://dl.dropboxusercontent.com/u/606131/lens-intro.md';

app.get('/', function(req, res) {
	res.render('playground');
});

app.post('/tosubstance', function(req, res) {
	console.log(req.body)
	toSubstance(req.body.url, req.body.syntax, req.body.id,function(err,result){
		console.log('got it!')
		res.json(result)
	});
	//console.log(doc)
	//res.json(doc)
});

app.listen(process.env.PORT || 5001);