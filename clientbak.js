var express = require("express");
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var querystring = require('querystring');
var cons = require('consolidate');
var randomstring = require("randomstring");


var app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
var authServer = {
	authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
	tokenEndpoint: 'https://www.googleapis.com//oauth2/v3/token'
};

// client information


/*
 * Add the client information in here
 */
var client = {
	"client_id": "767687922405-rnndp4osom0g6k9121ceqhq6a51oegq8.apps.googleusercontent.com",
	"client_secret": "5Fn2vS-aH54rY4VNpQgLS5md",
	"redirect_uris": ["http://localhost:9000/auth/google/callback"]
};

var protectedResource = 'http://localhost:9002/resource';

var state = null;

var access_token = null;
var scope = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req, res){

	state = randomstring.generate();

	var authorizeUrl = url.parse(authServer.authorizationEndpoint, true);
	delete authorizeUrl.search; // this is to get around odd behavior in the node URL library
	
	authorizeUrl.query.response_type = 'code';
	authorizeUrl.query.client_id = client.client_id;
	authorizeUrl.query.redirect_uri = client.redirect_uris[0]
	authorizeUrl.query.state = state;

	console.log("redirect", url.format(authorizeUrl));
	res.redirect(url.format(authorizeUrl));
});

app.get('/callback', function(req, res){

	var resState = req.query.state;
	if (resState != state) {
		console.log('State DOES NOT MATCH: expected %s got %s', state, resState);
		res.render('error', {error: 'State value did not match'});
		return;
	}

	var code = req.query.code;
	var form_data = qs.stringify({
									grant_type: 'authorization_code',
									code: code,
									redirect_uri: client.redirect_uris[0]
					});
	var headers = {
							'Content-Type': 'application/x-www-form-urlencoded',
							'Authorization': 'Basic ' + new Buffer(querystring.escape(client.client_id) + ':' + querystring.escape(client.client_secret)).toString('base64')
					};

	var tokRes = request('POST', authServer.tokenEndpoint,
					{
								body: form_data,
								headers: headers
					}
			);

	console.log('Requesting access token for code %s',code);
	
	if (tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
		var body = JSON.parse(tokRes.getBody());
	
		access_token = body.access_token;
		console.log('Got access token: %s', access_token);
		
		scope = body.scope;
		console.log('Got scope: %s', scope);

		res.render('index', {access_token: access_token, scope: scope});
	} else {
		res.render('error', {error: 'Unable to fetch access token, server response: ' + tokRes.statusCode})
	}
});

app.get('/fetch_resource', function(req, res) {

	if (!access_token) {
		res.render('error', {error: 'Missing access token.'});
		return;
	}
	
	var headers = {
		'Authorization': 'Bearer ' + access_token
	};
	
	var resource = request('POST', protectedResource, {headers: headers});
	if (resource.statusCode >= 200 && resource.statusCode < 300) {
		var body = JSON.parse(resource.getBody());

		res.render('data', {resource: body});
		return;
	} else {
		res.render('error', {error: 'Server returned response code: ' + resource.statusCode});
		return;
	}
});

app.use('/', express.static('files/client'));

var server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
 
