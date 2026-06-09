import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import type { AppStoreProvider } from '../../../../src/providers/app-store/types.js';
import type { App, AppSummary, Suggestion } from '../../../../src/schemas/index.js';
import { ProviderError, ErrorCode } from '../../../../src/errors/index.js';

const config = loadConfig({});

const baseApp: App = {
  id: 284882218,
  appId: 'com.facebook.Facebook',
  title: 'Facebook',
  url: 'https://apps.apple.com/us/app/facebook/id284882218',
  genres: ['Social Networking'],
  genreIds: ['6005'],
  primaryGenre: 'Social Networking',
  primaryGenreId: 6005,
  contentRating: '4+',
  released: '2008-08-01',
  updated: '2024-01-01',
  version: '400.0',
  price: 0,
  currency: 'USD',
  free: true,
  developerId: 284882218,
  developer: 'Meta Platforms, Inc.',
  developerUrl: 'https://itunes.apple.com/developer/id284882218',
  screenshots: [],
  ipadScreenshots: [],
  appletvScreenshots: [],
  supportedDevices: [],
  score: 4.2
};

const baseSummary: AppSummary = {
  id: '284882218',
  appId: 'com.facebook.Facebook',
  title: 'Facebook',
  icon: 'https://example.com/icon.png',
  price: 0,
  currency: 'USD',
  free: true,
  developer: 'Meta Platforms, Inc.',
  genre: 'Social Networking',
  genreId: '6005',
  released: '2008-08-01'
};

const suggestion: Suggestion = { term: 'facebook lite' };

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
};

function asResult (r: unknown): ToolResult {
  return r as ToolResult;
}

function makeProvider (overrides: Partial<AppStoreProvider> = {}): AppStoreProvider {
  const notImpl = () => Promise.reject(new ProviderError(ErrorCode.UNSUPPORTED_OPERATION, 'not implemented', false));
  return {
    getApp: notImpl,
    listApps: notImpl,
    searchApps: notImpl,
    getDeveloperApps: notImpl,
    getPrivacy: notImpl,
    getSuggestions: notImpl,
    getSimilarApps: notImpl,
    getReviews: notImpl,
    getRatings: notImpl,
    getVersionHistory: notImpl,
    ...overrides
  };
}

async function startTestServer (provider: AppStoreProvider) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(config, { appStore: provider });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

test('lists all 6 discovery tools', async () => {
  const { client } = await startTestServer(makeProvider());
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name);
  for (const name of [
    'app_store_get_app',
    'app_store_search_apps',
    'app_store_list_apps',
    'app_store_get_developer_apps',
    'app_store_get_suggestions',
    'app_store_get_similar_apps'
  ]) {
    assert.ok(names.includes(name), `Missing tool: ${name}`);
  }
});

test('tools carry readOnlyHint and openWorldHint', async () => {
  const { client } = await startTestServer(makeProvider());
  const { tools } = await client.listTools();
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} missing readOnlyHint`);
    assert.equal(tool.annotations?.openWorldHint, true, `${tool.name} missing openWorldHint`);
  }
});

// --- app_store_get_app ---

test('app_store_get_app: returns app details', async () => {
  const { client } = await startTestServer(makeProvider({
    getApp: () => Promise.resolve(baseApp)
  }));
  const result = asResult(await client.callTool({ name: 'app_store_get_app', arguments: { id: 284882218 } }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('Facebook'));
  assert.ok(text.includes('★4.2'));
  const sc = result.structuredContent as { data: App; meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
  assert.equal(sc.data.id, 284882218);
});

test('app_store_get_app: returns error when neither id nor appId provided', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({ name: 'app_store_get_app', arguments: {} }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('INVALID_ARGUMENT'));
});

test('app_store_get_app: propagates NOT_FOUND from provider', async () => {
  const { client } = await startTestServer(makeProvider({
    getApp: () => Promise.reject(new ProviderError(ErrorCode.NOT_FOUND, 'App not found (404)', false))
  }));
  const result = asResult(await client.callTool({ name: 'app_store_get_app', arguments: { id: 99999 } }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('NOT_FOUND'));
});

// --- app_store_search_apps ---

test('app_store_search_apps: returns app list', async () => {
  const { client } = await startTestServer(makeProvider({
    searchApps: () => Promise.resolve([baseApp])
  }));
  const result = asResult(await client.callTool({ name: 'app_store_search_apps', arguments: { term: 'facebook' } }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('1 app'));
  assert.ok(text.includes('"facebook"'));
});

test('app_store_search_apps: returns IDs when idsOnly is true', async () => {
  const { client } = await startTestServer(makeProvider({
    searchApps: () => Promise.resolve([284882218, 389801252])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'facebook', idsOnly: true }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('app IDs'));
  const sc = result.structuredContent as { data: number[] };
  assert.deepEqual(sc.data, [284882218, 389801252]);
});

test('app_store_search_apps: returns error for num above 200', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'test', num: 300 }
  }));
  assert.equal(result.isError, true);
});

// --- app_store_list_apps ---

test('app_store_list_apps: returns chart summaries', async () => {
  const { client } = await startTestServer(makeProvider({
    listApps: () => Promise.resolve([baseSummary])
  }));
  const result = asResult(await client.callTool({ name: 'app_store_list_apps', arguments: {} }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 app'));
  const sc = result.structuredContent as { meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
});

test('app_store_list_apps: returns error for invalid collection', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_list_apps',
    arguments: { collection: 'not-a-real-collection' }
  }));
  assert.equal(result.isError, true);
});

test('app_store_list_apps: returns error for invalid category', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_list_apps',
    arguments: { category: 99999999 }
  }));
  assert.equal(result.isError, true);
});

// --- app_store_get_developer_apps ---

test('app_store_get_developer_apps: returns developer apps', async () => {
  const { client } = await startTestServer(makeProvider({
    getDeveloperApps: () => Promise.resolve([baseApp])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_developer_apps',
    arguments: { devId: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('Meta Platforms'));
});

test('app_store_get_developer_apps: propagates NOT_FOUND', async () => {
  const { client } = await startTestServer(makeProvider({
    getDeveloperApps: () => Promise.reject(new ProviderError(ErrorCode.NOT_FOUND, 'Developer not found (404)', false))
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_developer_apps',
    arguments: { devId: 0 }
  }));
  assert.equal(result.isError, true);
});

// --- app_store_get_suggestions ---

test('app_store_get_suggestions: returns suggestions', async () => {
  const { client } = await startTestServer(makeProvider({
    getSuggestions: () => Promise.resolve([suggestion])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_suggestions',
    arguments: { term: 'face' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 suggestion'));
});

// --- app_store_get_similar_apps ---

test('app_store_get_similar_apps: returns similar apps', async () => {
  const { client } = await startTestServer(makeProvider({
    getSimilarApps: () => Promise.resolve([baseApp])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_similar_apps',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 app'));
});

test('app_store_get_similar_apps: returns error when no identifier provided', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_get_similar_apps',
    arguments: {}
  }));
  assert.equal(result.isError, true);
});
