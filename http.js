var inherits = require('util').inherits;
var http = require('http');
var url = require('url');
var Buffer = require('buffer').Buffer;
var crypto = require('crypto');

/**
 * Handler for HTTP Request
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse} response
 * @param {Array} stack Stack of operations. Each operation has next 
 *      interface: {
 *          'Http method* || DEFAULT': function() { ... },
 *          'ERROR': {String} function(code, message) { ... }
 *      }
 * @param {Array} args Optional arguments
 * @returns {Handler}
 */
function HttpHandler(request, response, stack, args) {
    this.request = request;
    this.response = response;
    this.args = args || [];
    
    this.stack = stack;
    this.level = -1; // Level in stack of operations
    this.logger = console;
    this.headersWritten = false;
    
    // Initial setup
    this.encoding = 'utf8';
    this.statusCode = 200;
    this.headers = {'Content-Type': "text/html; charset=UTF-8"};
};
exports.HttpHandler = HttpHandler;

/**
 * Executes next operation in stack. In operation selects the current 
 * request method ("GET", "POST" etc.) or "DEFAULT". 
 * 
 * If operation throws error - handles it. To generate a human readable error 
 * message uses method "ERROR" of operation.
 */
HttpHandler.prototype.next = function() {
    this.level++;
    var op = this.stack[this.level];
    try {
        var meth = op[this.request.method] || op['DEFAULT'];
        meth.apply(this, this.args);
    } catch (e) {
        var errGen = op['ERROR'] || ERROR;
        this._handleError(e, errGen);
    }
};

/**
 * Sets response status code. 
 * @param {Number} code HTTP Status code
 */
HttpHandler.prototype.setStatus = function(code) {
    if (!this.headersWritten && code in http.STATUS_CODES)
            this.statusCode = code;
};

/**
 * Set header.
 * @param {String} name
 * @param value
 */
HttpHandler.prototype.setHeader = function(name, value) {
    var value = value.toString();
    var safe = value.replace(/[\x00-\x1f]/, " ").substring(0, 4000);
    if (safe != value) throw new HttpError('Unsafe header value ' + value);
    this.headers[name] = value;
};

HttpHandler.prototype.write = function(data, encoding) {
    if (!data || data == null) return; // If no data - do nothing
    
    if (!this.headersWritten) this._sendHeaders();
    this.response.write(data, (encoding || this.encoding));
};

/**
 * 
 * @param data
 * @param encoding
 */
HttpHandler.prototype.end = function(data, encoding) {
    if (!this.headersWritten) {
        // if any data present - add some info in headers:
        if (!!data && this.statusCode == 200 && this.request.method == 'GET') {
            // ETag
            if (!('ETag' in this.headers)) {
                etag = '"' + crypto.createHash("sha1").
                        update(data).digest("hex") + '"';
                
                // Check if-none-match
                var inm = this.request.headers["if-none-match"];
                if (inm && inm.indexOf(etag) != -1) {
                    // Not modified - just send 304
                    this.response.writeHead(304);
                    this.response.end();
                    return;
                } else {
                    this.setHeader("ETag", etag);
                }
            }
            
            // Content-Length
            if (!("Content-Length" in this.headers)) {
                var l = Buffer.isBuffer(data) ? data.length 
                        : Buffer.byteLength(data, encoding || this._encoding);
                this.setHeader("Content-Length", l);
            }
        }
        this._sendHeaders();
    }
    this.response.end(data, encoding || this.encoding);
};

/**
 * Sends a redirect to the given (optionally relative) URL.
 * @param redirectUrl Redirect URL
 * @param permanent Permanent. Default = false
 * @throws HttpError
 */
HttpHandler.prototype.redirect = function(redirectUrl, permanent) {
    permanent = permanent || false;
    if (this.headersWritten) {
        throw new Error('Cannot redirect after headers have been written');
    }
    this.setStatus(permanent ? 301 : 302);
    redirectUrl = redirectUrl.replace(/[\x00-\x1f]/, "");
    this.setHeader('Location', url.resolve(this.request.url, redirectUrl));
    this.end();
};

/**
 * Sends all headers to client. If headers already written - send trailers.
 */
HttpHandler.prototype._sendHeaders = function() {
    this.headersWritten = true;
    this.response.writeHead(this.statusCode, this.headers);
};

/**
 * Handle error 
 * @param e error
 * @param errGen Optional error message generator
 */
HttpHandler.prototype._handleError = function(e, errGen) {
    errGen = errGen || ERROR;
    var consoleMessage = '';
    var code = 0;
    var message = '';
    
    if (e instanceof HttpError) {
        consoleMessage = e.code in http.STATUS_CODES ? 
                this._summary() + " " + e : "Bad HTTP status code " + e.code;
       
        code = e.code;
        message = e.message;
    } else {
        consoleMessage = "Uncaught exception in " + this._summary() + "\n" +
                (e.stack || e);
        code = 500;
        message = (e.stack || e);
    }
    this.logger.error(consoleMessage);
    
    if (!this.headersWritten) {
        this.statusCode = code;
        this.end(errGen(code, message));
    }
};

/**
 * Get request summary.
 * @returns {String}
 */
HttpHandler.prototype._summary = function() {
    return this.request.method + " " + this.request.url;
};

/**
 * Default function for genarate error html body.
 * @param {Number} code 
 * @param {String} message
 * @returns {String}
 */
function ERROR(code, message) {
    var msg = code + ": " + message; 
    return "<html><title>" + msg + "</title>" +
            "<body>" + msg + "</body></html>";
};
exports.ERROR = ERROR;

/**
 * HTTP Error
 * @constructor
 * @extends Error
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
inherits(HttpError, Error);
exports.HttpError = HttpError;