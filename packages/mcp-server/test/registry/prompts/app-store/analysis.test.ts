import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import { ErrorCode, ProviderError } from '../../../../src/errors/index.js';
import type { AppStoreProvider } from '../../../../src/providers/app-store/types.js';
import type { ToolProviders } from '../../../../src/registry/index.js';

const EXPECTED = [
  'app_store_analyze_market',
  'app_store_compare_competitors',
  'app_store_audit_listing',
  'app_store_analyze_reviews_and_ratings'
];

function makeProvider (): AppStoreProvider {
  const notImpl = () => Promise.reject(new ProviderError(ErrorCode.UNSUPPORTED_OPERATION, 'not implemented', false));
  return {
    getApp: notImpl, listApps: notImpl, searchApps: notImpl, getDeveloperApps: notImpl,
    getPrivacy: notImpl, getSuggestions: notImpl, getSimilarApps: notImpl,
    getReviews: notImpl, getRatings: notImpl, getVersionHistory: notImpl
  };
}

async function startTestServer (providers: ToolProviders = { appStore: makeProvider() }) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(loadConfig({}), providers);
  await server.connect(serverTransport);
  const client = new Client({ name: 'prompt-test', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

function text (result: Awaited<ReturnType<Client['getPrompt']>>): string {
  const content = result.messages[0]?.content;
  assert.ok(content !== undefined && content.type === 'text');
  return content.text;
}

test('lists all App Store analysis prompts when the provider is configured', async () => {
  const { client } = await startTestServer();
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map(value => value.name).sort(), [...EXPECTED].sort());
});

test('does not register App Store prompts without the provider capability', async () => {
  const { client } = await startTestServer({});
  await assert.rejects(() => client.listPrompts(), /Method not found/);
});

test('market analysis prompt references required tools, resources, and evidence rules', async () => {
  const { client } = await startTestServer();
  const result = await client.getPrompt({
    name: 'app_store_analyze_market',
    arguments: { term: 'calendar', country: 'gb', category: 'PRODUCTIVITY' }
  });
  const value = text(result);
  assert.match(value, /calendar/);
  assert.match(value, /GB/);
  assert.match(value, /app_store_search_apps/);
  assert.match(value, /app-store:\/\/reference\/categories/);
  assert.match(value, /Sourced facts/);
  assert.match(value, /Recommendations/);
});

test('competitor comparison prompt uses only supplied identifiers and read-only tools', async () => {
  const { client } = await startTestServer();
  const result = await client.getPrompt({
    name: 'app_store_compare_competitors',
    arguments: { appIdentifiers: '123, com.example.app' }
  });
  const value = text(result);
  assert.match(value, /123, com\.example\.app/);
  assert.match(value, /app_store_get_app/);
  assert.match(value, /app_store_get_privacy/);
  assert.doesNotMatch(value, /requestOptions|authorization|credentials/i);
});

test('listing and review prompts guide fact-analysis-recommendation separation', async () => {
  const { client } = await startTestServer();
  for (const name of ['app_store_audit_listing', 'app_store_analyze_reviews_and_ratings']) {
    const result = await client.getPrompt({
      name,
      arguments: { appIdentifier: '284882215', country: 'us' }
    });
    const value = text(result);
    assert.match(value, /Sourced facts/);
    assert.match(value, /Analysis/);
    assert.match(value, /Recommendations/);
  }
});

test('rejects prompt retrieval when required identifiers are missing', async () => {
  const { client } = await startTestServer();
  await assert.rejects(() => client.getPrompt({
    name: 'app_store_audit_listing',
    arguments: { country: 'us' }
  }));
});

test('rejects unsupported country code in analysis prompt', async () => {
  const { client } = await startTestServer();
  await assert.rejects(() => client.getPrompt({
    name: 'app_store_analyze_market',
    arguments: { term: 'productivity', country: 'xx' }
  }));
});

test('accepts supported country code in lowercase for analysis prompt', async () => {
  const { client } = await startTestServer();
  const result = await client.getPrompt({
    name: 'app_store_analyze_market',
    arguments: { term: 'productivity', country: 'gb' }
  });
  assert.match(text(result), /GB/);
});

test('accepts supported country code in uppercase for analysis prompt', async () => {
  const { client } = await startTestServer();
  const result = await client.getPrompt({
    name: 'app_store_analyze_market',
    arguments: { term: 'productivity', country: 'GB' }
  });
  assert.match(text(result), /GB/);
});

test('rejects unsupported country code in competitor comparison prompt', async () => {
  const { client } = await startTestServer();
  await assert.rejects(() => client.getPrompt({
    name: 'app_store_compare_competitors',
    arguments: { appIdentifiers: '123', country: 'zz' }
  }));
});

test('rejects unsupported country code in listing audit prompt', async () => {
  const { client } = await startTestServer();
  await assert.rejects(() => client.getPrompt({
    name: 'app_store_audit_listing',
    arguments: { appIdentifier: '284882215', country: 'xx' }
  }));
});

test('rejects unsupported country code in reviews and ratings prompt', async () => {
  const { client } = await startTestServer();
  await assert.rejects(() => client.getPrompt({
    name: 'app_store_analyze_reviews_and_ratings',
    arguments: { appIdentifier: '284882215', country: 'xx' }
  }));
});
