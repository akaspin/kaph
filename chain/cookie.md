# Kaph cookie

Architecture independent *node.js* module for work with cookies.

This module written on the basis of 
[cookie-node](https://github.com/jed/cookie-node) (with large parts of code). 
But unlike it, didn't extends `http.ServerRequest` and 
`http.ServerResponse` objects. Instead that. if it's not forbidden, *kaph 
cookie* decorate `writeHead` method of `http.ServerResponse` instance on first 
set of cookie. This design gives slightly higher but quite acceptable overhead.

## Usage

For use cookies you need make new instance of `cookie.Proc` with two 
argiments given to constructor: `request.headers` and `response`.

    var http = require('http');
    var kaphCookie = require('kaph/chain/cookie');
    
    kaphCookie.secret = 'myRandomSecretThatNoOneWillGuess';
    
    http.createServer(function(request, response) {
        // Make cookies object
        var cookie = new kaphCookie.Proc(request.headers, response);
        
        // Set simple cookie
        cookie.set('simple', 'Simple value');
        // ... and encrypted
        cookie.set('encrypted', 'Secret value', {days: 30}, true);
        
        // get some cookies
        var simple = cookie.get('simple');
        var encrypted = cookie.get('encrypted', true);
        
        response.writeHead(200, {'Content-Type': "text/html"});    
        response.end('simple: ' + simple + 
                ', encrypted: ' + encrypted);
    }).listen(9080);

New `cookie` object has two methods `set` and `get`.

`set` method of `cookie` object as is evident from its name, sets new cookie 
and takes four arguments: 

* `name` Cookie name
* `value` Cookie value
* `options` Optional cookie options (see below)
* `encrypt` Optional flag to encrypt cookie (see below)

Cookie `options` is object that may contain several optional properties:

* `expires` Cookie expiration `Date`
* `days` Expiration period in days from `expires` date. If `expires` not given,
  expiration period sets relative to current date.
* `path` Cookie path
* `domain` Cookie domain
* `secure` Secure (but not encrypted) cookie
* `httpOnly` HTTP only cookie

`get` method takes two arguments `name` and `decrypt` (see below), and returns
cookie value or `undefined` if cookie not exists.

### Encrypted cookies

You can encrypt and decrypt your cookies. All that is needed for this - set 
`true` for `encrypt` of `set` method and `decrypt` of `get`. Also you need to
set `secret` property of cookie module.

*You don't need to set the secret, but your cookies will end up being 
invalidated when the server restarts, and you will be yelled at.*

## Independent usage

If for any reason you don't want to decorate `writeHead` method, just add 
`true` as third argument of constructor:

    var http = require('http');
    var kaphCookie = require('kaph/chain/cookie');
    
    http.createServer(function(request, response) {
        // Make cookies object
        var cookie = new kaphCookie.Proc(request.headers, response, true);
        
        cookie.set('simple', 'Simple value');
        var simple = cookie.get('simple');
        
        response.writeHead(200, {'Content-Type': "text/html",
                'Set-Cookie': cookie.deploy()});    
        response.end('simple: ' + simple);
    }).listen(9080);
    
In this case `writeHead` method remains untouched and you can get all setted 
cookies by `deploy` method, that returns `Array` of prepared cookies.
    
## Kaph chain usage

