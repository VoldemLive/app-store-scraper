import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config.js';

test('loads documented defaults', () => {
  assert.deepEqual(loadConfig({}), {
    name: 'app-store-scraper-mcp',
    version: '0.1.0',
    logLevel: 'info'
  });
});

test('loads valid environment overrides', () => {
  assert.deepEqual(loadConfig({
    MCP_SERVER_NAME: 'custom-mcp',
    MCP_SERVER_VERSION: '2.0.0',
    MCP_LOG_LEVEL: 'debug'
  }), {
    name: 'custom-mcp',
    version: '2.0.0',
    logLevel: 'debug'
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
