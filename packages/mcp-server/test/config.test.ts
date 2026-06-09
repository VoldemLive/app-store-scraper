import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config.js';

test('loads documented defaults', () => {
  assert.deepEqual(loadConfig({}), {
    name: 'app-store-scraper-mcp',
    version: '0.1.0',
    logLevel: 'info',
    request: {
      timeoutMs: 10000,
      retries: 2,
      retryDelayMs: 250,
      maxRetryDelayMs: 5000,
      throttleRps: 10
    },
    cache: {
      ttlMs: 300000,
      maxEntries: 1000
    },
    response: {
      maxItems: 50,
      maxBytes: 1048576
    }
  });
});

test('loads valid environment overrides', () => {
  assert.deepEqual(loadConfig({
    MCP_SERVER_NAME: 'custom-mcp',
    MCP_SERVER_VERSION: '2.0.0',
    MCP_LOG_LEVEL: 'debug',
    MCP_REQUEST_TIMEOUT_MS: '2000',
    MCP_REQUEST_RETRIES: '1',
    MCP_REQUEST_THROTTLE_RPS: '5',
    MCP_CACHE_TTL_MS: '0',
    MCP_MAX_RESULT_ITEMS: '20',
    MCP_MAX_RESPONSE_BYTES: '2048'
  }), {
    name: 'custom-mcp',
    version: '2.0.0',
    logLevel: 'debug',
    request: {
      timeoutMs: 2000,
      retries: 1,
      retryDelayMs: 250,
      maxRetryDelayMs: 5000,
      throttleRps: 5
    },
    cache: {
      ttlMs: 0,
      maxEntries: 1000
    },
    response: {
      maxItems: 20,
      maxBytes: 2048
    }
  });
});

test('rejects invalid environment configuration without exposing values', () => {
  assert.throws(
    () => loadConfig({ MCP_LOG_LEVEL: 'secret-value' }),
    (error: unknown) => error instanceof ConfigError &&
      error.message === 'Invalid MCP server configuration' &&
      !error.message.includes('secret-value')
  );
});

test('rejects network and response controls outside documented bounds', () => {
  for (const env of [
    { MCP_REQUEST_TIMEOUT_MS: '99' },
    { MCP_REQUEST_RETRIES: '11' },
    { MCP_REQUEST_THROTTLE_RPS: '0' },
    { MCP_CACHE_TTL_MS: '-1' },
    { MCP_MAX_RESULT_ITEMS: '201' },
    { MCP_MAX_RESPONSE_BYTES: '1000' }
  ]) {
    assert.throws(() => loadConfig(env), ConfigError);
  }
});
