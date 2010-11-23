var inherits = require('util').inherits;
var http = require('http');

/**
 * Handler for HTTP Request
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse} response
 * @param {Array} chain chain of operations. See readme.
 * @param {Array} args Optional arguments
 * @returns {Handler}
 */
function Handler(request, response, chain, args) {
    this.request = request;
    this.response = response;
    this._args = args || [];
    
    this._chain = chain;
    this._level = -1; // Level in chain of operations
    
    this.logger = console; // default logger
};
exports.Handler = Handler;

/**
 * Executes next operation in chain. In operation selects the current 
 * request method ("GET", "POST" etc.) or "DEFAULT". 
 * 
 * If operation throws error - handles it. To generate a human readable error 
 * message uses method "ERROR" of operation.
 */
Handler.prototype.next = function() {
    this._level++;
    var op = this._chain[this._level];
    try {
        var meth = op[this.request.method] || op['DEFAULT'];
        if (!meth) throw new HandlerError(405, 'Operation hasn\'t methods ' + 
                this.request.method + ' or DEFAULT.');
        return meth.apply(this, this._args);
    } catch (e) {
        var errGen = op['ERROR'] || ERROR;
        this._handleError(e, errGen);
    }
};

Handler.prototype.error = function(code, reason) {
    var op = this._chain[this._level];
    var errGen = op['ERROR'] || ERROR;
    this._handleError(new HandlerError(code, reason), errGen);
};

/**
 * Handle error. 
 * @param e error
 * @param errGen Error message generator
 */
Handler.prototype._handleError = function(e, errGen) {
    var summary = this.request.method + " " + this.request.url + 
        ' (level ' + this._level + '):';
    var code = 0;
    var message = '';
    
    if (e instanceof HandlerError) {
        message = e.code in http.STATUS_CODES ? 
                summary + " " + e : 
                summary + "Bad HTTP status code " + e.code;
       
        code = e.code;
    } else {
        message = "Uncaught exception in " + summary + "\n" +
                (e.stack || e);
        code = 500;
    }
    this.logger.error(message);
    
    this.response.writeHead(code, 
            {'Content-Type': "text/html; charset=UTF-8"});
    this.response.end(errGen(code, message));
};

/**
 * Default function for generate error html body.
 * @param {Number} code 
 * @param {String} message
 * @returns {String}
 */
function ERROR(code, message) {
    return "<html><title>" + message + "</title>" +
            "<body><code>" + message + "</code></body></html>";
};
exports.ERROR = ERROR;

/**
 * HTTP Error
 * @constructor
 * @extends Error
 * @param code Optional status code. By default is "500"
 * @param reason Optional reason message
 */
function HandlerError(code, reason) {
    this.name = "HandlerError";
    this.code = code || 500;
    this.reason = reason || http.STATUS_CODES[this.code] || "Not implemented";
    this.message = this.code + ": " + this.reason;
    Error.captureStackTrace(this);
}
inherits(HandlerError, Error);
exports.HandlerError = HandlerError;