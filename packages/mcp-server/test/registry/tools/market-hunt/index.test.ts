import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import { MARKET_HUNT_CATEGORIES } from '../../../../src/market-hunt/index.js';

type ToolResult = {
  isError?: boolean;
  structuredContent?: {
    data?: {
      status?: string;
      seed_lineage?: Record<string, string>;
      metadata?: { compiler_version?: string };
    };
    meta?: { provider?: string };
  };
};

async function startTestServer () {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(loadConfig({}));
  await server.connect(serverTransport);
  const client = new Client({ name: 'market-hunt-test', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

test('always exposes only the public market hunt compiler operation', async () => {
  const { client } = await startTestServer();
  const { tools } = await client.listTools();
  const names = tools.map(tool => tool.name);

  assert.ok(names.includes('market_hunt_vector_compiler'));
  assert.ok(!names.includes('get_seed_space'));
  assert.ok(!names.includes('reload_seed_space'));
  assert.ok(!names.includes('compiler_info'));
  const tool = tools.find(value => value.name === 'market_hunt_vector_compiler');
  assert.equal(tool?.annotations?.readOnlyHint, true);
  assert.equal(tool?.annotations?.openWorldHint, false);
});

test('returns a complete deterministic raw lineage without interpretation', async () => {
  const { client } = await startTestServer();
  const call = () => client.callTool({
    name: 'market_hunt_vector_compiler',
    arguments: { strategy: 'full_random', random_seed: 'test-001' }
  }) as Promise<ToolResult>;

  const first = await call();
  const second = await call();
  assert.deepEqual(first.structuredContent?.data, second.structuredContent?.data);
  assert.equal(first.structuredContent?.data?.status, 'ok');
  assert.equal(first.structuredContent?.data?.metadata?.compiler_version, '1.0');
  assert.deepEqual(
    Object.keys(first.structuredContent?.data?.seed_lineage ?? {}),
    MARKET_HUNT_CATEGORIES
  );
  assert.equal(first.structuredContent?.meta?.provider, 'market-hunt');
  assert.equal('title' in (first.structuredContent?.data ?? {}), false);
});

test('rejects unsupported strategies and empty random seeds', async () => {
  const { client } = await startTestServer();
  for (const args of [
    { strategy: 'weighted_random' },
    { strategy: 'full_random', random_seed: '' }
  ]) {
    const result = await client.callTool({
      name: 'market_hunt_vector_compiler',
      arguments: args
    }) as ToolResult;
    assert.equal(result.isError, true);
  }
});
