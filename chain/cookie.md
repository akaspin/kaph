# Kaph cookie

Architecture independent *node.js* module for work with cookies.

This module written on the basis of 
[cookie-node](https://github.com/jed/cookie-node) (with large parts of code). 
But unlike it, didn't extends `http.ServerRequest` and 
`http.ServerResponse` objects. Instead that *kaph cookie* decorate 
`writeHead` method of `http.ServerResponse` instance on first set of cookie.

  