import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../src/server.js';
import { loadConfig } from '../../../src/config.js';
import { UnsupportedAppleAdsProvider } from '../../../src/providers/apple-ads/index.js';

test('accepts Apple Ads provider injection without exposing user-facing tools', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(loadConfig({}), { appleAds: new UnsupportedAppleAdsProvider() });
  await server.connect(serverTransport);
  const client = new Client({ name: 'apple-ads-stub-test', version: '1.0' });
  await client.connect(clientTransport);

  await assert.rejects(() => client.listTools(), /Method not found/);
});
