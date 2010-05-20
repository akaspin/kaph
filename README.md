# kaph

*kaph* is router-independent request handler for node.js.

## Usage

*kaph* does not interfere in node.js API. All that *kaph* do is two exports for 
simplify response flow control:

* `Handler` - template request handler class
* `HttpError` - Exception class

    var sys = require("sys");
    var http = require("http");
    var kaph = require("kaph");
    
    function Handler(request, response, context, args) {
        kaph.Handler.call(this, request, response, args);
        this.context = context;
    }
    sys.inherits(Handler, kaph.Handler);
    
    Handler.prototype.GET = function(name) {
        if (name == undefined) {
            throw new kaph.HttpError(404, "Not Found, wrong url");
        } else {
            this.end("Handled! " + name + "<br />" + 
                    "Setting: " + this.context.setting);
        }
    };
    
    var context = {setting: "Some setting"};
    
    http.createServer(function (request, response) {
        var args = [];
        if (request.url != '/') {
            args = [request.url];
        }
        
        (new Handler(request, response, context, args)).execute();
    }).listen(8888);
    


    
