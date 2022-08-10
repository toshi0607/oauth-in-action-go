const express = require("express");
const request = require("sync-request");
const url = require("url");
const qs = require("qs");
const querystring = require('querystring');
const cons = require('consolidate');
const randomstring = require("randomstring");
const __ = require('underscore');
__.string = require('underscore.string');

const app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
const authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information


/*
 * Add the client information in here
 */
const client = {
	"client_id": "oauth-client-1",
	"client_secret": "oauth-client-secret-1",
	"redirect_uris": ["http://localhost:9000/callback"]
};

const protectedResource = 'http://localhost:9002/resource';

let state = null;
let access_token = null;
let scope = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req, res){

	/*
	 * Send the user to the authorization server
	 */
	state = randomstring.generate()
	const authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
		response_type: 'code',
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		state: state
	});
	res.redirect(authorizeUrl);
});

app.get('/callback', function(req, res){

	/*
	 * Parse the response from the authorization server and get a token
	 */
	access_token = null;

	if (req.query.state !== state) {
		res.render('error', { error: 'State value did not match' });
		return;
	}

	const code = req.query.code
	const form_data = qs.stringify({
		grant_type: 'authorization_code',
		code: code,
		redirect_uri: client.redirect_uris[0]
	});
	const headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Basic ' + encodeClientCredentials(client.client_id, client.client_secret)
	};
	const tokRes = request('POST', authServer.tokenEndpoint,
		{
			body: form_data,
			headers: headers
		}
	);

	const body = JSON.parse(tokRes.body);
	access_token = body.access_token

	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/fetch_resource', function(req, res) {

	/*
	 * Use the access token to call the resource server
	 */
	if (!access_token) {
		res.render('error', { error: 'Missing access token.'});
		return;
	}

	const headers = {
		'Authorization': 'Bearer ' + access_token
	};
	const resource = request('POST', protectedResource, {headers: headers});

	if (resource.statusCode >= 200 && resource.statusCode < 300) {
		const body = JSON.parse(resource.body);
		res.render('data', { resource: body });
	} else {
		access_token = null;
		res.render('error', { error: 'Server returned response code:' + resource.statusCode });
	}
});

const buildUrl = function(base, options, hash) {
	const newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}
	
	return url.format(newUrl);
};

const encodeClientCredentials = function(clientId, clientSecret) {
	return Buffer.from(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

const server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
 
