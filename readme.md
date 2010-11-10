# Kaph*

*Kaph* is loose-coupled set of tools for handle requests under 
[node.js](http://nodejs.org). It's not framework.

*In the Phoenician alphabet letter "kaph" indicates palm.

## Design

Design of *kaph* was inspired by 
[Connect](http://github.com/senchalabs/Connect), 
[Tornado](http://www.tornadoweb.org/) and many others. But unlike them, it was 
designed to make all components as independent from each other without large 
overhead. 

## Usage

To handle request *Kaph* executes *chain* of defined operations.

    var http = require('http');
    var HttpHandler = require('kaph/http').Handler;
    
    // Make some operations
    OpA = {
        DEFAULT: function() {
            this.response.writeHead(200, 
                    {'Content-Type': "text/html; charset=UTF-8"});
            this.next();
        }    
    };
    OpB = {
        GET: function(arg) {
            this.response.end('OpB ' + arg);
        },
        ERROR: function(code, message) {
            return code + ' ' + message;
        }
    };
    
    var chain = [OpA, OpB]; // Our chain
    var arg = ['Some arg']; // Optional arguments
    
    http.createServer(function(request, response) {
        // Just make new kaph handler and call the method "next"
        (new HttpHandler(request, response, chain, arg)).next();
    }).listen(9080);

*Kaph* handler receives four arguments:

* `request` is standart *node.js* `http.ServerRequest`
* `response` is standart *node.js* `http.ServerResponse`
* `chain` `Array` of operations.
* `args` Optional `Array` of arguments.

`request` and `response` may not be instances of *node.js* `http` module. They 
simply must have the same behavior. Handler never interfere with their 
implementation. It use only `request.method` property to choose operation
method (see below) as well as `response`'s `writeHead` and `end` methods
on exceptions.

Now about `chain`. It's just `Array` of `Objects`. On each iteration *kaph* 
handler invokes operation methods by following these rules:

* If operation has method with name matching `request.method`, it performed as 
  a native method of handler (yes `apply`) with optional arguments.
* If operation hasn't named method, handler performs method with name 
  `DEFAULT`.

To invoke next operation in chain you must call `next` method of handler. 

## Error handling

*Kaph* trying to handle all throwed exceptions without crash entire server. On
exception *kaph* handler ends request, logs error and try to send it to client. 
To give a better description of exception you can throw new `kaph.HandlerError` 
with two arguments: status `code` and optional `message`. Another way to throw
exception is handler's `error` method with same arguments.

By default *kaph* handler generates client error message with own `kaph.ERROR` 
function. You can replace it with method `ERROR` of operation. `ERROR` method
also takes two `code` and `message` arguments and returns `String`.

## Handler properties

Because handler performs the methods of operations as own, it's implementation 
is important. Each instance has next properties:

* `request` ... well, you understand :)
* `response` ... well, it is also clear :)
* `logger` is just *node.js* `console`.

## Bundled operations

As stated in the beginning, *kaph* is not framework. But in directory `chain` 
you find a few things that can make life much more pleasant:

* [cookie](https://github.com/akaspin/kaph/blob/master/chain/cookie.md) - 
  work with cookies.
* [writer](https://github.com/akaspin/kaph/blob/master/chain/writer.md) - 
  facade for working with `http.ServerResponse`

Each of them can be used independently of *kaph*. And of course *kaph*, 
not depend on them.

## How about router?

I'm use my own [daleth](https://github.com/akaspin/daleth)

 