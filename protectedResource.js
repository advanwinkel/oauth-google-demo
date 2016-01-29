var express = require("express");
var bodyParser = require('body-parser');
var cons = require('consolidate');
var cors = require('cors');

var request = require("sync-request");

var app = express();

app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/protectedResource');
app.set('json spaces', 4);

app.use('/', express.static('files/protectedResource'));
app.use(cors());

var authServer = {
	authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
	tokenEndpoint: 'https://www.googleapis.com/oauth2/v3/token',
	userInfoEndpoint: 'https://www.googleapis.com/userinfo/v2/me'
};

var resource = {
	"name": "Protected Resource",
	"description": "This data has been protected by OAuth 2.0"
};

var userBody;

var getAccessToken = function(req, res, next) {
	// check the auth header first
	var auth = req.headers['authorization'];
	var inToken = null;
	if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
		inToken = auth.slice('bearer '.length);
	} else if (req.body && req.body.access_token) {
		// not in the header, check in the form body
		inToken = req.body.access_token;
	} else if (req.query && req.query.access_token) {
		inToken = req.query.access_token
	}
	
	console.log('Incoming token: %s', inToken);

	var headers = {
		'Authorization': 'Bearer ' + inToken
	};
	
		var userInfo = request('GET', authServer.userInfoEndpoint,
		{headers: headers}
	);
	if (userInfo.statusCode >= 200 && userInfo.statusCode < 300) {
		userBody = JSON.parse(userInfo.getBody());
		console.log('Got data: ', userBody);
		req.access_token = inToken;
		next();
		return;
	} else {
		console.log('Unable to fetch user information');
		return;
	}
	
};

app.options('/resource', cors());
app.post("/resource", cors(), getAccessToken, function(req, res){

	if (req.access_token) {
		res.json(userBody);
	} else {
		res.status(401).end();
	}
	
});

var server = app.listen(9002, '0.0.0.0', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
