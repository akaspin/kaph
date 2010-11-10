var crypto = require('crypto');
var Buffer = require('buffer').Buffer;

exports.secret = hex_hmac_sha1(Math.random(), Math.random());

/**
 * Kaph stack Cookie operation. 
 */
Op = {
    DEFAULT: function() {
        this.cookies = new Proc(this.request.headers, this.response);
        return this.next();
    }
};
exports.Op = Op;

/**
 * Cookie processor.
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse} response
 * @param {Boolean} dontDecorate Don't decorate 
 * @returns {Proc}
 */
function Proc(headers, response, dontDecorate) {
    this._headers = headers;
    this._response = response;
    this._dontDecorate = dontDecorate;
}
exports.Proc = Proc;

/**
 * Set cookie. If needed, at first call decorates method `writeHead` of 
 * instance `http.ServerResponse`.
 * @param {String} name 
 * @param value Cookie value
 * @param {Object} options Optional options. See readme.
 * @param {Boolean} encrypt Encrypt cookie value
 */
Proc.prototype.set = function(name, value, options, encrypt) {
    options = options || {};
    if (!this._outgoing) {
        this._outgoing = {};
        
        if (!this._dontDecorate) {
            // Decorate original method
            var _writeHead = this._response.writeHead;
            var COOKIE_KEY = 'Set-Cookie', slice = Array.prototype.slice;
            var self = this;
            this._response.writeHead = function() {
                // Honor the passed args and method signature
                // (see http.writeHead docs)
                var args = slice.call(arguments), headers = args[args.length - 1];
                if (!headers || typeof (headers) != 'object') {
                    // No header arg - create and append to args list
                    args.push(headers = []);
                }
                
                // Merge cookie values
                var prev = headers[COOKIE_KEY], cookies = self.deploy() || [];
                if (prev) cookies.push(prev);
                if (cookies.length > 0)
                    headers[COOKIE_KEY] = cookies;
                
                // Invoke original writeHead()
                _writeHead.apply(this, args);
            };
        }
    }
    
    // determine expiration date
    if (options.days) {
        options.expires = options.expires || new Date();
        options.expires.setDate(options.expires.getDate() + options.days);
    }

    // Serve value
    value = (value !== null && typeof value !== 'undefined') ?
            value.toString() : '';
    
    if (encrypt) {
        // If value is secure - encrypt
        value = [value.length, encode(value), options.expires ];
        var signature = hex_hmac_sha1(value.join("|"), exports.secret);
        value.push(signature);
        value = value.join('|').replace(/=/g, '*');
    }

    // Form cookie
    var cookie = name + '=' + escape(value) + ';';
    options.expires && (cookie += ' expires=' + 
                options.expires.toUTCString() + ";");
    options.path && (cookie += ' path=' + options.path + ';');
    options.domain && (cookie += ' domain=' + options.domain + ';');
    options.secure && (cookie += ' secure;');
    options.httpOnly && (cookie += ' httponly');

    this._outgoing[name] = cookie;
};

/**
 * Get cookie by name
 * @param {String} name
 * @param {Boolean} decrypt
 */
Proc.prototype.get = function(name, decrypt) {
    // Parse cookies if not yet parsed
    if (!this._incoming) {
        var header = this._headers["cookie"] || "";
        var self = this;
        this._incoming = {};
        
        header.split(";").forEach( function( cookie ) {
            var parts = cookie.split("="),
            name =  (parts[0] ? parts[0].trim() : ''),
            value = (parts[1] ? parts[1].trim() : '');
            self._incoming[name] = unescape(value);
        });
    }
    
    var value = this._incoming[name];
    
    // Decript value if needed
    if (decrypt && value) {
        var parts = value.replace(/\*/g, '=').split("|");
        if (parts.length !== 4) {
            return;
        }
        
        var len = parts[0];
        value = decode(parts[1]).substr(0, len);
        var expires = new Date(+parts[2]);
        var remoteSig = parts[3];
        
        if ( expires < new Date ) {
            return;
        }
        
        var localSig = hex_hmac_sha1(parts.slice(0, 3).join("|"), 
                exports.secret);
        
        if ( localSig !== remoteSig ) {
            throw new Error("invalid cookie signature: " + name);
        }
        return value;
    }
    return value;
};

/**
 * Clears cookie
 * @param {String} name
 */
Proc.prototype.clear = function(name) {
    options = {expires: new Date( +new Date - 30 * 24 * 60 * 60 * 1000) };
    this.set(name, '', options);
};

/**
 * Generate "Set-Cookie" header value
 * @returns {Array}
 */
Proc.prototype.deploy = function() {
    if (!this._outgoing) return;
    var stream = [];
    for (var k in this._outgoing) {
        stream.push(this._outgoing[k]);
    }
    return stream;
};

/**
 * Generate hash.
 * @param data data
 * @returns {String} hash
 */
function hex_hmac_sha1(data, key) {
    var hmac = crypto.createHmac('sha1', key);
    hmac.update(data);
    return hmac.digest('hex');
}

/**
 * Encode data to base64
 * @param data
 * @returns {String}
 */
function encode(data) {
    return (new Buffer(data)).toString('base64');
}
/**
 * Decode data from base64
 * @param data
 * @returns {String}
 */
function decode(data) {
    return (new Buffer(data, 'base64')).toString('utf8');
}