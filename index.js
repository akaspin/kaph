/**
 * Kaph. Routerless HTTP handler for node.js
 */

var util = require('util');
var http = require('http');
var url = require('url');
var Buffer = require('buffer').Buffer;
var crypto = require('crypto');

/**
 * Kaph request handler.
 * 
 * @constructor
 * 
 * @param request Original request
 * @param response Original clear response
 * @param args Optional Array of arguments
 * @type args Array
 * @returns {Handler}
 */
function Handler(request, response, args) {
    // request
    this.request = request;
    //response
    this.response = response;
    // arguments
    this.args = args || [];
    
    this._headersWritten = false; // Headers not written
    this.clear(); // clear all
}
exports.Handler = Handler;

// Supported methods
Handler.prototype._supportedMethods = 
        ['HEAD', 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

/**
 * HEAD method. Must be implemented.
 * @throws HttpError
 */
Handler.prototype.HEAD = function() {
    throw new HttpError(405, "HEAD not implemented");
};

/**
 * GET method. Must be implemented.
 * @throws HttpError
 */
Handler.prototype.GET = function() {
    throw new HttpError(405, "GET not implemented");
};

/**
 * POST method. Must be implemented.
 * @throws HttpError
 */
Handler.prototype.POST = function() {
    throw new HttpError(405, "POST not implemented");
};

/**
 * PUT method. Must be implemented.
 * @throws HttpError
 */
Handler.prototype.PUT = function() {
    throw new HttpError(405, "PUT not implemented");
};

/**
 * DELETE method. Must be implemented.
 * @throws HttpError
 */
Handler.prototype.DELETE = function() {
    throw new HttpError(405, "DELETE not implemented");
};

/**
 * OPTIONS method. Must be implemented.
 * @throws HttpError
 * 
 */
Handler.prototype.OPTIONS = function() {
    throw new HttpError(405, "OPTIONS not implemented");
};

/**
 * Generate error HTML page.
 * @param code Status code
 * @param message Message
 * @returns {String} Error html
 */
Handler.prototype.getErrorHtml = function(code, message) {
    var msg = code + ": " + message; 
    return "<html><title>" + msg + "</title>" +
            "<body>" + msg + "</body></html>";
};

/**
 * Sets response status code.
 * @param code Status code
 */
Handler.prototype.setStatus = function(code) {
    if (code in http.STATUS_CODES) this._statusCode = code;
};

/**
 * Sets the given response header name and value.
 * @param name Header name
 * @param value Header value
 * @throws HttpError
 */
Handler.prototype.setHeader = function(name, value) {
    var value = value.toString();
    var safe = value.replace(/[\x00-\x1f]/, " ").substring(0, 4000);
    if (safe != value) throw new Error('Unsafe header value ' + value);
    this._headers[name] = value;
};

/**
 * Sends all headers to client.
 */
Handler.prototype.sendHeaders = function() {
    this._headersWritten = true;
    this.response.writeHead(this._statusCode, this._headers);
};

/**
 * Writes data to client. 
 * If headers not sent - sends they first.
 * @param data 
 * @param encoding
 */
Handler.prototype.write = function(data, encoding) {
    if (!this._headersWritten) {
        this.sendHeaders();
    }
//    if (data instanceof Object) {
//        this.setHeader("Content-Type", "text/javascript; charset=UTF-8");
//        data = JSON.stringify(data);
//    }
    
    this.response.write((data == undefined ? "" : data.toString()), 
            (encoding || this._encoding));
};

/**
 * Ends response.
 * @param data
 * @param encoding
 */
Handler.prototype.end = function(data, encoding) {
    data = data || "";
    if (!this._headersWritten) {
        // If headers not written yet - add some info in headers:
        
        // ETags
        if (this._statusCode == 200 && this.request.method == 'GET' &&
                !('ETag' in this._headers) && have_openssl) {
            etag = '"' + crypto.createHash("sha1").
                    update(data).digest("hex") + '"';
            
            var inm = this.request.headers["if-none-match"];
            if (inm && inm.indexOf(etag) != -1) {
                // Not modified - just send 304
                this.response.writeHead(304);
                this.response.end("");
                return;
            } else {
                this.setHeader("ETag", etag);
            }
            
            // and content length
            if (!("Content-Length" in this._headers)) {
                var l = this._encoding == 'utf8' ?
                        Buffer.byteLength(data, 'utf8') :
                        data.length;
                this.setHeader("Content-Length", l);
            }
        }
        this.sendHeaders();
    }    
    this.response.end(data, (encoding || this._encoding));
};

/**
 * Sends a redirect to the given (optionally relative) URL.
 * @param redirectUrl Redirect URL
 * @param permanent Permanent. Default = false
 * @throws HttpError
 */
Handler.prototype.redirect = function(redirectUrl, permanent) {
    permanent = permanent || false;
    if (this._headersWritten) {
        throw new Error('Cannot redirect after headers have been written');
    }
    this.setStatus(permanent ? 301 : 302);
    redirectUrl = redirectUrl.replace(/[\x00-\x1f]/, "");
    this.setHeader('Location', url.resolve(this.request.url, redirectUrl));
    this.end();
};

/**
 * Sends the given HTTP error code to the browser.
 * @param code Error code
 * @param message Error Message
 */
Handler.prototype.sendError = function(code, message) {
    this.clear();
    this.setStatus(code);
    this.end(this.getErrorHtml(code, message));
};

/**
 * Executes handler. Catches all errors
 */
Handler.prototype.execute = function() {
    try {
        if (this._supportedMethods.indexOf(this.request.method) == -1)
            throw new HttpError(405);
        
        this[this.request.method].apply(this, this.args);
    } catch (e) {
        this.handleError(e);
    }
};

/**
 * Handles all exceptions in request. 
 * Logs it and send to client if possible.
 * @param e Exception
 */
Handler.prototype.handleError = function(e) {
    if (e instanceof HttpError) {
        if (e.code in http.STATUS_CODES) {
            console.error(this._summary() + " " + e);
            this.sendError(e.code, e.reason);
        } else {
            console.error("Bad HTTP status code %d", e.code);
            this.sendError(e.code, e.reason);
        }
    } else {
        console.error("Uncaught exception in " + this._summary() + "\n" +
                (e.stack || e));
        this.sendError(500, (e.stack || e));
    }
};

/**
 * Get request summary.
 * @returns {String}
 */
Handler.prototype._summary = function() {
    return this.request.method + " " + this.request.url;
};

/**
 * Cleans response.
 */
Handler.prototype.clear = function() {
    this._headers = {
            "Server": "node.js:" + process.version,
            "Content-Type": "text/html; charset=UTF-8"
    };
    this._statusCode = 200;
    this._encoding = 'utf8';
};

/**
 * HTTP Error
 * @constructor
 * @param code Status code
 * @param reason Reason
 */
function HttpError(code, reason) {
    //Error.call(this);
    this.name = "HttpError";
    this.code = code || 500;
    this.reason = reason || http.STATUS_CODES[this.code] || "Not implemented";
    this.message = this.code + " " + this.reason;
    Error.captureStackTrace(this);
}
util.inherits(HttpError, Error);
exports.HttpError = HttpError;
