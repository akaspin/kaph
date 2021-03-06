# Kaph cookie

Architecture independent [node.js](http://nodejs.org) module for work with 
cookies.

This module written on the basis of 
[cookie-node](https://github.com/jed/cookie-node) (with large parts of code). 
But unlike it, didn't extends `http.ServerRequest` and `http.ServerResponse` 
objects. Instead that. if it's not forbidden, *kaph cookie* decorate 
`writeHead` method of `http.ServerResponse` instance on first set of cookie. 
Also *kaph cookie* provides object for control. This design gives slightly 
higher but quite acceptable overhead.

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
        
        // Get some cookies
        var simple = cookie.get('simple');
        var encrypted = cookie.get('encrypted', true);
        
        // And kill!
        cookie.clear('notneeded');
        
        response.writeHead(200, {'Content-Type': "text/html"});    
        response.end('simple: ' + simple + 
                ', encrypted: ' + encrypted);
    }).listen(9080);

New `cookie` object has three methods `set`, `get` and `clear`.

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

Also you can unset cookies with `clear` method that takes only one parameter - 
cookie name.

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
        var cookie = new kaphCookie.Proc(request.headers, response, true);
        
        cookie.set('simple', 'Simple value');
        var simple = cookie.get('simple');
        
        response.writeHead(200, {'Content-Type': "text/html",
                'Set-Cookie': cookie.deploy()});    
        response.end('simple: ' + simple);
    }).listen(9080);
    
In this case `writeHead` method remains untouched and you can get all setted 
cookies by `deploy` method, that returns `Array` of prepared cookies.
    
## Usage in Kaph chain

This module provides *operation* to use with *kaph*. Usage is similar to that 
described above. With one difference - operation creates a new object `cookies` 
inside *kaph* handler.

    var http = require('http');
    var HttpHandler = require('kaph/http').Handler;
    var kaphCookie = require('kaph/chain/cookie');
    
    Op = {
        GET: function() {
            this.cookies.set('simple', 'Simple value');
            var simple = this.cookies.get('simple');
    
            this.response.writeHead(200, 
                    {'Content-Type': "text/html; charset=UTF-8"});
            this.response.end('simple: ' + simple);
        }
    };
    
    var chain = [kaphCookie.Op, Op];
    
    http.createServer(function(request, response) {
        (new HttpHandler(request, response, chain)).next();
    }).listen(9080);

## Pitfalls

All pitfalls of this module concluded that "kaph" decorates `writeHead` method 
of `http.ServerResponse` instance. If you use any architecture, that also 
decorates this method - use *Kaph cookie* **after** all other decorations.

For usage with *kaph* chain I recommend insert cookie *Operation* after all 
others that may decorate `writeHead` method, and just before operations that 
can write to `response`. 


