var http = require('http');
var url = require('url');
var Buffer = require('buffer').Buffer;
var crypto = require('crypto');

/**
 * Kaph stack Writer operation. Just makes writer object in Handler.
 */
Op = {
    DEFAULT: function() {
        this.writer = new Writer(this.request, this.response);
        return this.next();
    }
};
exports.Op = Op;

/**
 * Writer facade.
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse} response
 * @returns {Writer}
 */
function Writer(request, response) {
    this._request = request;
    this._response = response;
    
    this._encoding = 'utf8';
    this._statusCode = 200;
    this._headers = {'Content-Type': "text/html; charset=UTF-8"};
}
exports.Writer = Writer;

/**
 * Sets response status code. 
 * @param {Number} code HTTP Status code
 */
Writer.prototype.setStatus = function(code) {
    if (!this._response._headerSent && code in http.STATUS_CODES)
            this._statusCode = code;
};

/**
 * Set response header.
 * @param {String} name
 * @param value
 * @throws {Error}
 */
Writer.prototype.setHeader = function(name, value) {
    if (this._response._headerSent) return;
    value = value ? value.toString() : '';
    if (value != value.replace(/[\x00-\x1f]/, " ").substring(0, 4000))
        throw new Error('Unsafe header value ' + value);
    this._headers[name] = value;
};

/**
 * Write to response
 * @param data
 * @param encoding
 */
Writer.prototype.write = function(data, encoding) {
    if (!data) return; // If no data - do nothing
    if (!Buffer.isBuffer(data) && typeof data !== 'string')
            data = data.toString();
    if (!this._response._headerSent) this._sendHeaders();
    this._response.write(data, (encoding || this._encoding));
};

/**
 * 
 * @param data
 * @param encoding
 */
Writer.prototype.end = function(data, encoding) {
    if (data && !Buffer.isBuffer(data) && typeof data !== 'string')
            data = data.toString();
    if (!this._response._headerSent) {
        // if any data present - add some info in headers:
        if (!!data && this._statusCode == 200 
                && this._request.method == 'GET') {
            // ETag
            if (!('ETag' in this._headers)) {
                etag = '"' + crypto.createHash("sha1").
                        update(data).digest("hex") + '"';
                
                // Check if-none-match
                var inm = this._request.headers["if-none-match"];
                if (inm && inm.indexOf(etag) != -1) {
                    // Not modified - just send 304
                    this._response.writeHead(304);
                    this._response.end();
                    return;
                } else {
                    this.setHeader("ETag", etag);
                }
            }
            
            // Content-Length
            if (!("Content-Length" in this._headers)) {
                var l = Buffer.isBuffer(data) ? data.length 
                        : Buffer.byteLength(data, encoding || this._encoding);
                this.setHeader("Content-Length", l);
            }
        }
        this._sendHeaders();
    }
    this._response.end(data, encoding || this._encoding);
};

/**
 * Sends a redirect to the given (optionally relative) URL.
 * @param redirectUrl Redirect URL
 * @param permanent Permanent. Default = false
 * @throws HttpError
 */
Writer.prototype.redirect = function(redirectUrl, permanent) {
    permanent = permanent || false;
    if (this._response._headerSent) {
        throw new Error('Cannot redirect after headers have been written');
    }
    this.setStatus(permanent ? 301 : 302);
    redirectUrl = redirectUrl.replace(/[\x00-\x1f]/, "");
    this.setHeader('Location', url.resolve(this._request.url, redirectUrl));
    this.end();
};

/**
 * Sends all headers to client.
 */
Writer.prototype._sendHeaders = function() {
    this._response.writeHead(this._statusCode, this._headers);
};