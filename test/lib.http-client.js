import { assert } from 'chai';
import * as http from 'node:http';
import * as zlib from 'node:zlib';
import common from '../lib/common.js';
import request from '../lib/http-client.js';

describe('HTTP client', () => {
  let server;
  let baseUrl;
  let retryAttempts;

  before((done) => {
    retryAttempts = {};
    server = http.createServer((req, res) => {
      retryAttempts[req.url] = (retryAttempts[req.url] || 0) + 1;
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
      if (req.url === '/retry' && retryAttempts[req.url] < 3) {
        res.writeHead(503);
        return res.end('retry');
      }
      if (req.url === '/always-retry') {
        res.writeHead(503);
        return res.end('retry');
      }
      if (req.url === '/bad-request') {
        res.writeHead(400);
        return res.end('bad request');
      }
      if (req.url === '/slow') {
        return setTimeout(() => res.end('slow'), 100);
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

  it('should retry transient responses', (done) => {
    request({
      url: `${baseUrl}/retry`,
      retryDelay: 1
    }, (error, response, body) => {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
      assert.equal(body, 'GET');
      assert.equal(retryAttempts['/retry'], 3);
      done();
    });
  });

  it('should stop after exhausting retries', (done) => {
    request({
      url: `${baseUrl}/always-retry`,
      retries: 2,
      retryDelay: 1
    }, (error, response) => {
      assert.isNull(error);
      assert.equal(response.statusCode, 503);
      assert.equal(retryAttempts['/always-retry'], 3);
      done();
    });
  });

  it('should terminate timed out requests', (done) => {
    request({
      url: `${baseUrl}/slow`,
      timeout: 10,
      retries: 0
    }, (error) => {
      assert.equal(error.code, 'ETIMEDOUT');
      done();
    });
  });

  it('should abort active requests without retrying', (done) => {
    const controller = new AbortController();
    request({
      url: `${baseUrl}/slow`,
      signal: controller.signal,
      retries: 2,
      retryDelay: 1
    }, (error) => {
      assert.equal(error.name, 'AbortError');
      assert.equal(error.code, 'ABORT_ERR');
      assert.equal(retryAttempts['/slow'], 1);
      done();
    });
    controller.abort();
  });

  it('should reject non-retryable responses with HTTP context', () => {
    return common.request(`${baseUrl}/bad-request`, {}, { retries: 2, retryDelay: 1 })
      .then(assert.fail)
      .catch((error) => {
        assert.equal(error.message, 'Request failed with status code 400');
        assert.equal(error.response.statusCode, 400);
        assert.equal(error.body, 'bad request');
        assert.equal(retryAttempts['/bad-request'], 1);
      });
  });

  it('should isolate concurrent throttle configurations', () => {
    const startedAt = Date.now();
    const saturated = Array.from({ length: 11 }, () => (
      common.request(`${baseUrl}/response`, {}, {}, 10)
    ));
    const independent = common.request(`${baseUrl}/response`, {}, {}, 1)
      .then(() => assert.isBelow(Date.now() - startedAt, 500));

    return Promise.all(saturated.concat(independent));
  });

  it('should reject invalid throttle values', () => {
    return Promise.all([0, -1, 1.5].map((throttle) => (
      common.request(`${baseUrl}/response`, {}, {}, throttle)
        .then(assert.fail)
        .catch((error) => assert.equal(error.message, 'throttle must be a positive integer'))
    )));
  });
});
