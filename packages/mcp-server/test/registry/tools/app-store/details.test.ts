import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import type { AppStoreProvider } from '../../../../src/providers/app-store/types.js';
import type { Review, Ratings, PrivacyDetails, VersionHistoryItem } from '../../../../src/schemas/index.js';
import { ProviderError, ErrorCode } from '../../../../src/errors/index.js';

const config = loadConfig({});

const baseReview: Review = {
  id: '1',
  userName: 'Alice',
  userUrl: 'https://itunes.apple.com/profile/1',
  version: '1.0',
  score: 5,
  title: 'Great app',
  text: 'Really useful',
  url: 'https://itunes.apple.com/review/1',
  updated: '2024-01-01T00:00:00.000Z'
};

const baseRatings: Ratings = {
  ratings: 1000,
  histogram: { '5': 700, '4': 200, '3': 50, '2': 30, '1': 20 }
};

const basePrivacy: PrivacyDetails = {
  managePrivacyChoicesUrl: null,
  privacyTypes: [
    {
      privacyType: 'Data Used to Track You',
      identifier: 'DATA_USED_TO_TRACK_YOU',
      description: 'The following data may be used to track you across apps.',
      dataCategories: [],
      purposes: []
    }
  ]
};

const baseVersionItem: VersionHistoryItem = {
  versionDisplay: '2.0',
  releaseNotes: 'Bug fixes and performance improvements',
  releaseDate: '2024-01-01',
  releaseTimestamp: '2024-01-01T00:00:00.000Z'
};

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

// --- app_store_get_reviews ---

test('app_store_get_reviews: returns review list', async () => {
  const { client } = await startTestServer(makeProvider({
    getReviews: () => Promise.resolve([baseReview])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_reviews',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('1 review'));
  assert.ok(text.includes('284882218'));
  const sc = result.structuredContent as { data: Review[]; meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
  assert.equal(sc.data[0]?.userName, 'Alice');
});

test('app_store_get_reviews: returns error when neither id nor appId provided', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_get_reviews',
    arguments: {}
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('INVALID_ARGUMENT'));
});

test('app_store_get_reviews: propagates NOT_FOUND from provider', async () => {
  const { client } = await startTestServer(makeProvider({
    getReviews: () => Promise.reject(new ProviderError(ErrorCode.NOT_FOUND, 'App not found (404)', false))
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_reviews',
    arguments: { id: 99999 }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('NOT_FOUND'));
});

test('app_store_get_reviews: returns error for page above 10', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'app_store_get_reviews',
    arguments: { id: 284882218, page: 11 }
  }));
  assert.equal(result.isError, true);
});

test('app_store_get_reviews: accepts valid sort param', async () => {
  const { client } = await startTestServer(makeProvider({
    getReviews: () => Promise.resolve([baseReview])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_reviews',
    arguments: { appId: 'com.facebook.Facebook', sort: 'mostHelpful' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('com.facebook.Facebook'));
});

// --- app_store_get_ratings ---

test('app_store_get_ratings: returns rating statistics', async () => {
  const { client } = await startTestServer(makeProvider({
    getRatings: () => Promise.resolve(baseRatings)
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_ratings',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('284882218'));
  assert.ok(text.includes('1000 rating'));
  const sc = result.structuredContent as { data: Ratings; meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
  assert.equal(sc.data.ratings, 1000);
});

test('app_store_get_ratings: propagates NOT_FOUND from provider', async () => {
  const { client } = await startTestServer(makeProvider({
    getRatings: () => Promise.reject(new ProviderError(ErrorCode.NOT_FOUND, 'App not found (404)', false))
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_ratings',
    arguments: { id: 99999 }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('NOT_FOUND'));
});

// --- app_store_get_privacy ---

test('app_store_get_privacy: returns privacy details', async () => {
  const { client } = await startTestServer(makeProvider({
    getPrivacy: () => Promise.resolve(basePrivacy)
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_privacy',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('1 privacy type'));
  assert.ok(text.includes('284882218'));
  const sc = result.structuredContent as { meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
});

test('app_store_get_privacy: propagates UPSTREAM_CHANGED from provider', async () => {
  const { client } = await startTestServer(makeProvider({
    getPrivacy: () => Promise.reject(new ProviderError(ErrorCode.UPSTREAM_CHANGED, 'Privacy details not found', false))
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_privacy',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('UPSTREAM_CHANGED'));
});

// --- app_store_get_version_history ---

test('app_store_get_version_history: returns version list', async () => {
  const { client } = await startTestServer(makeProvider({
    getVersionHistory: () => Promise.resolve([baseVersionItem])
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_version_history',
    arguments: { id: 284882218 }
  }));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  assert.ok(text.includes('1 version'));
  assert.ok(text.includes('284882218'));
  const sc = result.structuredContent as { data: VersionHistoryItem[]; meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
  assert.equal(sc.data[0]?.versionDisplay, '2.0');
});

test('app_store_get_version_history: propagates NOT_FOUND from provider', async () => {
  const { client } = await startTestServer(makeProvider({
    getVersionHistory: () => Promise.reject(new ProviderError(ErrorCode.NOT_FOUND, 'App not found (404)', false))
  }));
  const result = asResult(await client.callTool({
    name: 'app_store_get_version_history',
    arguments: { id: 99999 }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('NOT_FOUND'));
});
