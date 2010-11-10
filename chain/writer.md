# Kaph writer

Simple *facade* for working with [node.js](http://nodejs.org) 
`http.ServerResponse` inspired by [Tornado](http://www.tornadoweb.org/).

## Usage

*Kaph writer* just provides *facade* object for "brain-free" work with 
HTTP responses.

    var http = require('http');
    var kaphWriter = require('../kaph/chain/writer').Writer;
    
    http.createServer(function(request, response) {
        var writer = new kaphWriter(request, response);
        writer.end('It\'s works');
    }).listen(9080);

*Kaph writer* constructor takes two arguments: `request` and `response`. 
Instance of *Kaph writer* provides several methods (they will be described 
below): `setStatus`, `setHeader`, `write`, `end` and `redirect`.

### setStatus and setHeader

`setStatus` Sets response status code and takes one `Number` argument - code. 
By default, response status code is `200`.

    writer.setStatus(404);
    
Response status code will be setted if match any of *node.js* 
`http.STATUS_CODES`. Otherwise, it will not be setted.

`setHeader` sets one response header. Takes two arguments: header's name and
value. Non-`String` values will be converted by their `toString` method. 
`undefined` will be converted to empty `String`. 

    writer.setHeader('Big-Date', new Date());
    
By default in `writer` object already setted header `Content-Type` with value
`text/html; charset=UTF-8`. Of course you can change it to any what you want. 
If given value is "unsafe", `setHeader` throws exception.

`setStatus` and `setHeader` methods doesn't write anything to 
`http.ServerResponse`.

### write and end methods

Both methods are very similar to *node.js* `http.ServerResponse` methods, dut 
do for you some boring stuff. First, `write` and `end` checks if headers that 
setted by `setHeader` method not written yet, they write these headers to 
`response`. 

    writer.write('Chunk');
    writer.end()
    
`write` writes a chunk of the response body and takes two arguments: `data` 
and optional `encoding`. By default `encoding` is `utf8`. `data` handles by 
following rules:

* `Buffer` and `String` values leaves untouched.
* All values except `undefined` will be converted to `String`
* `undefined` values will be silently discarded and nothing will be writed to
  `response` include headers.

`end` method also takes two arguments, but both these are optional. This method
always ends `response`. `data` handles by rules similar to `write` method with 
one exception: `undefined` data also ends response.

If headers not written yet (ie `write` method never called), `end` method with
non `undefined` data do something more:

* If you not set "ETag" header by `setHeader` method `end` do it for you with
  `sha1` hash of data.
* If `request` has "If-None-Match" header, after calculating "ETag" `end` will 
  compare these headers, and if they match - sends `304` (Not modified) 
  response to client.
* If "If-None-Match" and "ETag" not equal (or `request` hasn't "If-None-Match"
  header), `end` calculates "Content-Length" of data and set both response
  headers.

### redirect

This method redirects client to given location. `redirect` takes two arguments:
redirect URL and optional `permanent` flag.

    writer.redirect('/new/url');
    
With `permanent` flag, `redirect` send client status `301` instead of `302`. 
You can't redirect after after headers have been written.

## Usage in Kaph chain

This module provides *operation* to use with *kaph*. Usage is similar to that 
described above. With one difference - operation creates a new object `writer` 
inside *kaph* handler.

    var http = require('http');
    var HttpHandler = require('kaph/http').Handler;
    var kaphWriter = require('kaph/chain/writer');
    
    Op = {
        GET: function() {
            this.writer.end('It\'s works');
        }
    };
    
    var chain = [kaphWriter.Op, Op];
    
    http.createServer(function(request, response) {
        (new HttpHandler(request, response, chain)).next();
    }).listen(9080);
    
