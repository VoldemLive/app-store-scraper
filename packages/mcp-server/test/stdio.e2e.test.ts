import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cli = resolve('dist/src/cli.js');

test('completes an MCP handshake and ping over stdio without stdout noise', async () => {
  const client = new Client({
    name: 'mcp-server-e2e-test',
    version: '1.0.0'
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: {
      MCP_SERVER_NAME: 'stdio-e2e-server',
      MCP_SERVER_VERSION: '9.8.7',
      MCP_LOG_LEVEL: 'error'
    },
    stderr: 'pipe'
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => {
    stderr += chunk.toString();
  });

  try {
    await client.connect(transport);
    await client.ping();

    assert.deepEqual(client.getServerVersion(), {
      name: 'stdio-e2e-server',
      version: '9.8.7'
    });
    assert.equal(stderr, '');
  } finally {
    await client.close();
  }
});

test('reports startup failure only on stderr', () => {
  const result = spawnSync(process.execPath, [cli], {
    encoding: 'utf8',
    env: {
      MCP_LOG_LEVEL: 'invalid'
    }
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'MCP server startup failed.\n');
});

test('lists all 6 discovery tools via stdio', async () => {
  const client = new Client({ name: 'tool-discovery-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { MCP_LOG_LEVEL: 'error' },
    stderr: 'pipe'
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const expected = [
      'app_store_get_app',
      'app_store_search_apps',
      'app_store_list_apps',
      'app_store_get_developer_apps',
      'app_store_get_suggestions',
      'app_store_get_similar_apps'
    ];
    for (const name of expected) {
      assert.ok(names.includes(name), `Missing tool: ${name}`);
    }
  } finally {
    await client.close();
  }
});

test('lists all 4 detail tools via stdio', async () => {
  const client = new Client({ name: 'tool-detail-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { MCP_LOG_LEVEL: 'error' },
    stderr: 'pipe'
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const expected = [
      'app_store_get_reviews',
      'app_store_get_ratings',
      'app_store_get_privacy',
      'app_store_get_version_history'
    ];
    for (const name of expected) {
      assert.ok(names.includes(name), `Missing tool: ${name}`);
    }
  } finally {
    await client.close();
  }
});

test('lists all 5 reference resources via stdio', async () => {
  const client = new Client({ name: 'resource-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { MCP_LOG_LEVEL: 'error' },
    stderr: 'pipe'
  });

  try {
    await client.connect(transport);
    const { resources } = await client.listResources();
    const uris = resources.map(r => r.uri);
    const expected = [
      'app-store://reference/collections',
      'app-store://reference/categories',
      'app-store://reference/sort',
      'app-store://reference/devices',
      'app-store://reference/markets'
    ];
    for (const uri of expected) {
      assert.ok(uris.includes(uri), `Missing resource: ${uri}`);
    }
    const result = await client.readResource({ uri: 'app-store://reference/sort' });
    const content = result.contents[0];
    assert.ok(content !== undefined);
    const data = JSON.parse('text' in content ? (content.text ?? '') : '{}') as Record<string, string>;
    assert.equal(data['RECENT'], 'mostRecent');
  } finally {
    await client.close();
  }
});

test('closes gracefully on SIGTERM without writing to stdout', async () => {
  const child = spawn(process.execPath, [cli], {
    env: {
      MCP_LOG_LEVEL: 'error'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  await new Promise(resolveDelay => setTimeout(resolveDelay, 2000));
  child.kill('SIGTERM');
  const [code, signal] = await once(child, 'exit');

  assert.equal(code, 0);
  assert.equal(signal, null);
  assert.equal(stdout, '');
  assert.equal(stderr, 'MCP server shutting down after SIGTERM.\n');
});
