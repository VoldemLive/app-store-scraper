'use strict';

const http = require('http');
const https = require('https');
const zlib = require('zlib');

const REDIRECT_CODES = [301, 302, 303, 307, 308];

function decompress (response) {
  const encoding = response.headers['content-encoding'];

  if (encoding === 'gzip') {
    return response.pipe(zlib.createGunzip());
  }
  if (encoding === 'deflate') {
    return response.pipe(zlib.createInflate());
  }
  if (encoding === 'br') {
    return response.pipe(zlib.createBrotliDecompress());
  }

  return response;
}

function readBody (response, callback) {
  const chunks = [];
  const stream = decompress(response);

  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', callback);
  stream.on('end', () => callback(null, response, Buffer.concat(chunks).toString()));
}

function redirectOptions (options, response) {
  const location = new URL(response.headers.location, options.url).toString();
  const redirects = (options.redirects || 0) + 1;
  const redirected = Object.assign({}, options, { url: location, redirects });

  if (response.statusCode === 303 ||
    ((response.statusCode === 301 || response.statusCode === 302) && options.method !== 'GET')) {
    redirected.method = 'GET';
    delete redirected.body;
  }

  return redirected;
}

function request (options, callback) {
  options = Object.assign({ method: 'GET', maxRedirects: 5 }, options);
  const url = new URL(options.url);
  const transport = url.protocol === 'https:' ? https : http;
  const requestOptions = Object.assign({}, options, {
    headers: options.headers,
    method: options.method
  });

  delete requestOptions.body;
  delete requestOptions.maxRedirects;
  delete requestOptions.redirects;
  delete requestOptions.url;

  const req = transport.request(url, requestOptions, (response) => {
    if (REDIRECT_CODES.includes(response.statusCode) && response.headers.location) {
      response.resume();
      if ((options.redirects || 0) >= options.maxRedirects) {
        return callback(Error('Too many redirects'), response);
      }
      return request(redirectOptions(options, response), callback);
    }

    readBody(response, callback);
  });

  req.on('error', callback);
  if (options.body !== undefined) {
    req.write(options.body);
  }
  req.end();

  return req;
}

module.exports = request;
