import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/server.js';
import { loadConfig } from '../../src/config.js';
import { ErrorCode, ProviderError } from '../../src/errors/index.js';
import type { Logger, LogEvent } from '../../src/application/index.js';
import type { AppStoreProvider, SearchAppsInput } from '../../src/providers/app-store/types.js';
import type { App } from '../../src/schemas/index.js';

const app: App = {
  id: 1,
  appId: 'com.example.app',
  title: 'Example',
  url: 'https://apps.apple.com/app/id1',
  description: 'full description',
  genres: ['Utilities'],
  genreIds: ['6002'],
  primaryGenre: 'Utilities',
  primaryGenreId: 6002,
  contentRating: '4+',
  released: '2020-01-01',
  updated: '2024-01-01',
  version: '1.0.0',
  price: 0,
  currency: 'USD',
  free: true,
  developerId: 2,
  developer: 'Example Dev',
  developerUrl: 'https://apps.apple.com/developer/id2',
  screenshots: [],
  ipadScreenshots: [],
  appletvScreenshots: [],
  supportedDevices: []
};

function makeProvider (overrides: Partial<AppStoreProvider> = {}): AppStoreProvider {
  const notImpl = () => Promise.reject(new ProviderError(ErrorCode.UNSUPPORTED_OPERATION, 'not implemented', false));
  return {
    getApp: notImpl, listApps: notImpl, searchApps: notImpl, getDeveloperApps: notImpl,
    getPrivacy: notImpl, getSuggestions: notImpl, getSimilarApps: notImpl,
    getReviews: notImpl, getRatings: notImpl, getVersionHistory: notImpl,
    getGenres: notImpl, getGrouping: notImpl, getRoomApps: notImpl,
    ...overrides
  };
}

async function startServer (
  provider: AppStoreProvider,
  env: NodeJS.ProcessEnv = {},
  events: LogEvent[] = []
) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const logger: Logger = { log: event => events.push(event) };
  const server = createMcpServer(loadConfig(env), { appStore: provider }, logger);
  await server.connect(serverTransport);
  const client = new Client({ name: 'controls-test', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

test('bounds list results and uses compact mode by default', async () => {
  const { client } = await startServer(makeProvider({
    searchApps: () => Promise.resolve([app, { ...app, id: 2 }, { ...app, id: 3 }])
  }), { MCP_MAX_RESULT_ITEMS: '2' });

  const result = await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'example' }
  }) as unknown as {
    structuredContent: { data: Array<Record<string, unknown>>; meta: Record<string, unknown> }
  };

  assert.equal(result.structuredContent.data.length, 2);
  assert.equal(result.structuredContent.data[0]?.['description'], undefined);
  assert.equal(result.structuredContent.meta['responseMode'], 'compact');
  assert.equal(result.structuredContent.meta['totalCount'], 3);
  assert.equal(result.structuredContent.meta['truncated'], true);
});

test('supports full mode and explicit field projection', async () => {
  const { client } = await startServer(makeProvider({
    searchApps: () => Promise.resolve([app])
  }));

  const full = await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'example', responseMode: 'full' }
  }) as unknown as { structuredContent: { data: Array<Record<string, unknown>> } };
  assert.equal(full.structuredContent.data[0]?.['description'], 'full description');

  const projected = await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'example', fields: ['title'] }
  }) as unknown as { structuredContent: { data: Array<Record<string, unknown>> } };
  assert.deepEqual(projected.structuredContent.data[0], { title: 'Example' });
});

test('returns RESPONSE_TOO_LARGE for oversized structured content', async () => {
  const { client } = await startServer(makeProvider({
    getApp: () => Promise.resolve({ ...app, description: 'x'.repeat(2000) })
  }), { MCP_MAX_RESPONSE_BYTES: '1024' });

  const result = await client.callTool({
    name: 'app_store_get_app',
    arguments: { id: 1 }
  }) as { isError?: boolean; content: Array<{ text: string }> };

  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? '', /RESPONSE_TOO_LARGE/);
});

test('does not forward arbitrary URL or requestOptions tool arguments', async () => {
  let received: SearchAppsInput | undefined;
  const { client } = await startServer(makeProvider({
    searchApps: input => {
      received = input;
      return Promise.resolve([]);
    }
  }));

  await client.callTool({
    name: 'app_store_search_apps',
    arguments: {
      term: 'example',
      url: 'https://attacker.example',
      requestOptions: { headers: { authorization: 'secret' } }
    }
  });

  assert.deepEqual(received, { term: 'example' });
});

test('logs operation timing and normalized outcome without tool input values', async () => {
  const events: LogEvent[] = [];
  const { client } = await startServer(makeProvider({
    searchApps: () => Promise.resolve([])
  }), {}, events);

  await client.callTool({
    name: 'app_store_search_apps',
    arguments: { term: 'sensitive-search-value' }
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.operation, 'app_store_search_apps');
  assert.equal(events[0]?.outcome, 'success');
  assert.equal(typeof events[0]?.durationMs, 'number');
  assert.doesNotMatch(JSON.stringify(events), /sensitive-search-value/);
});
