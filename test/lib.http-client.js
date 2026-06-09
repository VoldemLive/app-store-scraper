'use strict';

const assert = require('chai').assert;
const http = require('http');
const zlib = require('zlib');
const request = require('../lib/http-client');

describe('HTTP client', () => {
  let server;
  let baseUrl;

  before((done) => {
    server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        if (req.url === '/body') {
          return res.end(Buffer.concat(chunks).toString());
        }
        if (req.url === '/header') {
          return res.end(req.headers['x-test']);
        }
      });

      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/response' });
        return res.end();
      }
      if (req.url === '/gzip') {
        res.writeHead(200, { 'content-encoding': 'gzip' });
        return res.end(zlib.gzipSync('compressed'));
      }
      if (req.url === '/body' || req.url === '/header') {
        return;
      }

      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(req.method);
    });
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after((done) => server.listening ? server.close(done) : done());

  it('should make requests and return the response body', (done) => {
    request({ url: `${baseUrl}/response`, method: 'DELETE' }, (error, response, body) => {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
      assert.equal(body, 'DELETE');
      done();
    });
  });

  it('should follow redirects', (done) => {
    request({ url: `${baseUrl}/redirect` }, (error, response, body) => {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
      assert.equal(body, 'GET');
      done();
    });
  });

  it('should decompress response bodies', (done) => {
    request({ url: `${baseUrl}/gzip` }, (error, response, body) => {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
      assert.equal(body, 'compressed');
      done();
    });
  });

  it('should send request headers and bodies', (done) => {
    request({
      url: `${baseUrl}/body`,
      method: 'POST',
      body: 'payload'
    }, (error, response, body) => {
      assert.isNull(error);
      assert.equal(body, 'payload');

      request({
        url: `${baseUrl}/header`,
        headers: { 'X-Test': 'header-value' }
      }, (headerError, headerResponse, headerBody) => {
        assert.isNull(headerError);
        assert.equal(headerBody, 'header-value');
        done();
      });
    });
  });
});
