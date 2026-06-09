'use strict';

const http = require('http');
const https = require('https');
const zlib = require('zlib');

const REDIRECT_CODES = [301, 302, 303, 307, 308];
const RETRY_CODES = [408, 429, 500, 502, 503, 504];

function once (callback) {
  let called = false;
  return function () {
    if (!called) {
      called = true;
      callback.apply(null, arguments);
    }
  };
}

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

function canRetry (options) {
  return options.method === 'GET' && options.retryCount < options.retries;
}

function retryDelay (options, response) {
  const retryAfter = response && response.headers['retry-after'];
  let delay = options.retryDelay * Math.pow(2, options.retryCount);

  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryDate = Date.parse(retryAfter);
    delay = Number.isNaN(seconds) ? retryDate - Date.now() : seconds * 1000;
  }

  return Math.max(0, Math.min(delay, options.maxRetryDelay));
}

function retry (options, response, callback) {
  const nextOptions = Object.assign({}, options, { retryCount: options.retryCount + 1 });
  setTimeout(() => request(nextOptions, callback), retryDelay(options, response));
}

function request (options, callback) {
  options = Object.assign({
    method: 'GET',
    maxRedirects: 5,
    timeout: 10000,
    retries: 2,
    retryCount: 0,
    retryDelay: 250,
    maxRetryDelay: 5000
  }, options);
  callback = once(callback);
  const url = new URL(options.url);
  const transport = url.protocol === 'https:' ? https : http;
  const requestOptions = Object.assign({}, options, {
    headers: options.headers,
    method: options.method
  });

  delete requestOptions.body;
  delete requestOptions.maxRedirects;
  delete requestOptions.redirects;
  delete requestOptions.retries;
  delete requestOptions.retryCount;
  delete requestOptions.retryDelay;
  delete requestOptions.maxRetryDelay;
  delete requestOptions.url;

  const req = transport.request(url, requestOptions, (response) => {
    if (REDIRECT_CODES.includes(response.statusCode) && response.headers.location) {
      response.resume();
      if ((options.redirects || 0) >= options.maxRedirects) {
        return callback(Error('Too many redirects'), response);
      }
      return request(redirectOptions(options, response), callback);
    }
    if (RETRY_CODES.includes(response.statusCode) && canRetry(options)) {
      response.resume();
      return retry(options, response, callback);
    }

    readBody(response, callback);
  });

  req.on('error', (error) => {
    if (canRetry(options)) {
      return retry(options, null, callback);
    }
    callback(error);
  });
  req.setTimeout(options.timeout, () => {
    const error = Error(`Request timed out after ${options.timeout}ms`);
    error.code = 'ETIMEDOUT';
    req.destroy(error);
  });
  if (options.body !== undefined) {
    req.write(options.body);
  }
  req.end();

  return req;
}

module.exports = request;
