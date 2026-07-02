import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cli = resolve('dist/src/cli.js');

function waitFor (predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolveWait, rejectWait) => {
    const started = Date.now();
    const poll = () => {
      if (predicate()) {
        resolveWait();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        rejectWait(new Error('Timed out waiting for condition'));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

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

test('logs MCP and service connection points on startup stderr', async () => {
  const client = new Client({
    name: 'mcp-server-startup-log-test',
    version: '1.0.0'
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: {
      MCP_SERVER_NAME: 'startup-log-server',
      MCP_SERVER_VERSION: '1.2.3',
      MCP_LOG_LEVEL: 'info'
    },
    stderr: 'pipe'
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => {
    stderr += chunk.toString();
  });

  try {
    await client.connect(transport);
    await waitFor(() => stderr.includes('mcp_server_startup'));

    const logs = stderr.trim().split('\n').map(line => JSON.parse(line) as {
      operation?: string;
      details?: {
        mcp?: {
          transport?: string;
          serverName?: string;
          serverVersion?: string;
          connectionHint?: string;
          clientConfig?: {
            mcpServers?: {
              app_store?: {
                command?: string;
                args?: string[];
                env?: Record<string, string>;
              };
            };
          };
        };
        services?: Array<{ name?: string; endpoint?: string }>;
      };
    });
    const startup = logs.find(log => log.operation === 'mcp_server_startup');
    assert.ok(startup);
    assert.equal(startup.details?.mcp?.transport, 'stdio');
    assert.equal(startup.details?.mcp?.serverName, 'startup-log-server');
    assert.equal(startup.details?.mcp?.serverVersion, '1.2.3');
    assert.match(startup.details?.mcp?.connectionHint ?? '', /stdio has no HTTP URL or port/);
    assert.equal(startup.details?.mcp?.clientConfig?.mcpServers?.app_store?.command, process.execPath);
    assert.deepEqual(startup.details?.mcp?.clientConfig?.mcpServers?.app_store?.args, [cli]);
    assert.deepEqual(startup.details?.mcp?.clientConfig?.mcpServers?.app_store?.env, {
      MCP_LOG_LEVEL: 'info',
      MCP_REQUEST_TIMEOUT_MS: '10000'
    });
    assert.ok(startup.details?.services?.some(service =>
      service.name === 'app-store-lookup' &&
      service.endpoint === 'https://itunes.apple.com/lookup'
    ));
    assert.ok(startup.details?.services?.some(service =>
      service.name === 'apple-ads-api' &&
      service.endpoint === 'https://api.searchads.apple.com/api/v5'
    ));
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

test('lists all 9 discovery tools via stdio', async () => {
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
      'app_store_get_similar_apps',
      'app_store_get_genres',
      'app_store_get_grouping',
      'app_store_get_room_apps'
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

test('lists and calls the raw search vector compiler via stdio', async () => {
  const client = new Client({ name: 'search-vector-e2e', version: '1.0.0' });
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
    assert.ok(tools.some(tool => tool.name === 'search_vector_compiler'));
    const result = await client.callTool({
      name: 'search_vector_compiler',
      arguments: { strategy: 'full_random', random_seed: 'stdio-test' }
    }) as { structuredContent?: { data?: { status?: string } } };
    assert.equal(result.structuredContent?.data?.status, 'ok');
  } finally {
    await client.close();
  }
});

test('lists all 6 reference resources via stdio', async () => {
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
      'app-store://reference/markets',
      'app-store://reference/groupings'
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

test('lists all 4 App Store prompts via stdio', async () => {
  const client = new Client({ name: 'prompt-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { MCP_LOG_LEVEL: 'error' },
    stderr: 'pipe'
  });

  try {
    await client.connect(transport);
    const { prompts } = await client.listPrompts();
    const names = prompts.map(prompt => prompt.name);
    for (const name of [
      'app_store_analyze_market',
      'app_store_compare_competitors',
      'app_store_audit_listing',
      'app_store_analyze_reviews_and_ratings'
    ]) {
      assert.ok(names.includes(name), `Missing prompt: ${name}`);
    }
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
