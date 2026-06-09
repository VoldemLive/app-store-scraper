import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import { ProviderError, ErrorCode } from '../../../../src/errors/index.js';
import type { AppStoreProvider } from '../../../../src/providers/app-store/types.js';

const config = loadConfig({});

function makeProvider (): AppStoreProvider {
  const notImpl = () => Promise.reject(new ProviderError(ErrorCode.UNSUPPORTED_OPERATION, 'not implemented', false));
  return {
    getApp: notImpl, listApps: notImpl, searchApps: notImpl, getDeveloperApps: notImpl,
    getPrivacy: notImpl, getSuggestions: notImpl, getSimilarApps: notImpl,
    getReviews: notImpl, getRatings: notImpl, getVersionHistory: notImpl
  };
}

async function startTestServer () {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(config, { appStore: makeProvider() });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

const EXPECTED_URIS = [
  'app-store://reference/collections',
  'app-store://reference/categories',
  'app-store://reference/sort',
  'app-store://reference/devices',
  'app-store://reference/markets'
];

test('lists all 5 reference resources', async () => {
  const { client } = await startTestServer();
  const { resources } = await client.listResources();
  const uris = resources.map(r => r.uri);
  for (const uri of EXPECTED_URIS) {
    assert.ok(uris.includes(uri), `Missing resource: ${uri}`);
  }
});

test('resources carry application/json mimeType', async () => {
  const { client } = await startTestServer();
  const { resources } = await client.listResources();
  for (const resource of resources) {
    if (EXPECTED_URIS.includes(resource.uri)) {
      assert.equal(resource.mimeType, 'application/json', `${resource.uri} missing mimeType`);
    }
  }
});

test('collections resource returns valid JSON with all 13 collection keys', async () => {
  const { client } = await startTestServer();
  const result = await client.readResource({ uri: 'app-store://reference/collections' });
  const content = result.contents[0];
  assert.ok(content !== undefined);
  assert.equal(content.mimeType, 'application/json');
  const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, string>;
  assert.equal(typeof data, 'object');
  assert.ok(Object.keys(data).length >= 13, 'Expected at least 13 collections');
  assert.ok('TOP_FREE_IOS' in data, 'Missing TOP_FREE_IOS');
  assert.equal(data['TOP_FREE_IOS'], 'topfreeapplications');
});

test('categories resource returns valid JSON with numeric values', async () => {
  const { client } = await startTestServer();
  const result = await client.readResource({ uri: 'app-store://reference/categories' });
  const content = result.contents[0];
  assert.ok(content !== undefined);
  const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, number>;
  assert.ok(Object.keys(data).length >= 20, 'Expected at least 20 categories');
  assert.ok('GAMES' in data, 'Missing GAMES category');
  assert.equal(typeof data['GAMES'], 'number');
});

test('sort resource returns RECENT and HELPFUL keys', async () => {
  const { client } = await startTestServer();
  const result = await client.readResource({ uri: 'app-store://reference/sort' });
  const content = result.contents[0];
  assert.ok(content !== undefined);
  const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, string>;
  assert.equal(data['RECENT'], 'mostRecent');
  assert.equal(data['HELPFUL'], 'mostHelpful');
});

test('devices resource returns IPAD, MAC, and ALL keys', async () => {
  const { client } = await startTestServer();
  const result = await client.readResource({ uri: 'app-store://reference/devices' });
  const content = result.contents[0];
  assert.ok(content !== undefined);
  const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, string>;
  assert.equal(data['IPAD'], 'iPadSoftware');
  assert.equal(data['MAC'], 'macSoftware');
  assert.equal(data['ALL'], 'software');
});

test('markets resource returns storefront IDs for known country codes', async () => {
  const { client } = await startTestServer();
  const result = await client.readResource({ uri: 'app-store://reference/markets' });
  const content = result.contents[0];
  assert.ok(content !== undefined);
  const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, number>;
  assert.ok(Object.keys(data).length > 50, 'Expected many market entries');
  assert.equal(typeof Object.values(data)[0], 'number');
});

test('resource contents are deterministic across reads', async () => {
  const { client } = await startTestServer();
  const r1 = await client.readResource({ uri: 'app-store://reference/collections' });
  const r2 = await client.readResource({ uri: 'app-store://reference/collections' });
  assert.ok(r1.contents[0] !== undefined, 'r1 has no content');
  assert.ok(r2.contents[0] !== undefined, 'r2 has no content');
  const c1 = r1.contents[0];
  const c2 = r2.contents[0];
  assert.ok('text' in c1, 'r1 content is not text');
  assert.ok('text' in c2, 'r2 content is not text');
  assert.equal((c1 as { text: string }).text, (c2 as { text: string }).text);
});
