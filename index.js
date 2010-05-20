var sys = require('sys');
var http = require('http');

//openssl support
var have_openssl;
try {
  var crypto = require('crypto');
  have_openssl=true;
} catch (e) {
  have_openssl=false;
}

/**
 * Kaph request handler.
 * @constructor
 * 
 * @param request Original request
 * @param response Original clear response
 * @param context Context
 * @param args Array of arguments
 * @returns {Handler}
 */
function Handler(request, response, args) {
	this.request = request;
	this.response = response;
	this.args = args || [];
	
	this._headersWritten = false; // Headers not written
	
	this.clear();
}
exports.Handler = Handler;

Handler.prototype._supportedMethods = 
		['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];

Handler.prototype.HEAD = function() {
	throw new HttpError(405, "HEAD not implemented");
};

Handler.prototype.GET = function() {
	throw new HttpError(405, "GET not implemented")
};

Handler.prototype.POST = function() {
	throw new HttpError(405, "POST not implemented")
};

Handler.prototype.PUT = function() {
	throw new HttpError(405, "PUT not implemented")
};

Handler.prototype.DELETE = function() {
	throw new HttpError(405, "DELETE not implemented")
};

/**
 * Generates error html.
 * @param code Status code
 * @param message Message
 * @returns Error html
 */
Handler.prototype.getErrorHtml = function(code, message) {
	var msg = code + ": " + message; 
	return "<html><title>" + msg + "</title>" +
			"<body>" + msg + "</body></html>";
}

/**
 * Sets response status code.
 * @param code Status code
 */
Handler.prototype.setStatus = function(code) {
	if (code in http.STATUS_CODES) this._statusCode = code;
}

/**
 * Sets the given response header name and value.
 * @param name Header name
 * @param value Header value
 */
Handler.prototype.setHeader = function(name, value) {
	var value = value.toString()
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
 * Writes data to client. If headers not sent - sends they first.
 * @param data 
 * @param encoding
 */
Handler.prototype.write = function(data, encoding) {
	if (!this._headersWritten) {
		this.sendHeaders();
	}
//	if (data instanceof Object) {
//		this.setHeader("Content-Type", "text/javascript; charset=UTF-8");
//		data = JSON.stringify(data);
//	}
	
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
				this.setHeader("Content-Length", data.length);
			}
		}
		this.sendHeaders();
	}	
	this.response.end(data, (encoding || this._encoding));
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
 * Actually executes handler.
 */
Handler.prototype.execute = function() {
	try {
		if (this._supportedMethods.indexOf(this.request.method) == -1)
			throw new HttpError(405);
		
		this[this.request.method].apply(this, this.args);
	} catch (e) {
		this._handleException(e);
	}
};

/**
 * Just resets all to initial states.
 */
Handler.prototype.clear = function() {
	this._headers = {
			"Server": "node.js:" + process.version,
			"Content-Type": "text/html; charset=UTF-8",
	};
	this._statusCode = 200;
	this._encoding = 'utf8';
};

/**
 * Handles all exceptions in request. Logs it and send to client if possible.
 * @param e Exception
 */
Handler.prototype._handleException = function(e) {
	if (e instanceof HttpError) {
		if (e.code in http.STATUS_CODES) {
			sys.error(this._summary() + " " + e);
			this.sendError(e.code, e.reason);
		} else {
			sys.error("Bad HTTP status code " + e.code);
			this.sendError(e.code, e.reason);
		}
	} else {
		sys.error("Uncaught exception in " + this._summary() + "\n" +
				(e.stack || e));
		this.sendError(500, (e.stack || e));
	}
};

Handler.prototype._summary = function() {
	return this.request.method + " " + this.request.url;
}

/**
 * HTTP Error
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
sys.inherits(HttpError, Error);
exports.HttpError = HttpError;
