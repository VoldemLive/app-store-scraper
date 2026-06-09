import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const packageRoot = resolve('.');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'app-store-mcp-package-'));

function npm (args, cwd) {
  return execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_cache: join(temporaryRoot, 'npm-cache'),
      npm_config_fund: 'false'
    },
    timeout: 120000
  });
}

try {
  const pack = JSON.parse(npm([
    'pack',
    '--json',
    '--pack-destination',
    temporaryRoot
  ], packageRoot))[0];
  const paths = pack.files.map(file => file.path);
  const cli = pack.files.find(file => file.path === 'dist/src/cli.js');

  assert.ok(paths.includes('README.md'));
  assert.ok(paths.includes('LICENSE'));
  assert.ok(paths.includes('package.json'));
  assert.ok(paths.every(path =>
    path === 'README.md' ||
    path === 'LICENSE' ||
    path === 'package.json' ||
    path.startsWith('dist/src/')
  ));
  assert.ok(cli !== undefined && (cli.mode & 0o111) !== 0, 'packed CLI must be executable');

  writeFileSync(join(temporaryRoot, 'package.json'), '{"private":true,"type":"module"}\n');
  npm(['install', join(temporaryRoot, pack.filename)], temporaryRoot);

  const executable = join(temporaryRoot, 'node_modules', '.bin', 'app-store-mcp');
  assert.ok((statSync(executable).mode & 0o111) !== 0, 'installed CLI must be executable');

  const smoke = `
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'packed-mcp-smoke', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: ${JSON.stringify(executable)},
  env: { MCP_LOG_LEVEL: 'error' },
  stderr: 'pipe'
});
let stderr = '';
transport.stderr?.on('data', chunk => {
  stderr += chunk.toString();
});
try {
  try {
    await client.connect(transport);
    await client.ping();
    assert.equal(client.getServerVersion()?.name, 'app-store-scraper-mcp');
  } catch (error) {
    throw new Error(\`Packed MCP handshake failed: \${stderr}\`, { cause: error });
  }
} finally {
  await client.close();
}
`;
  writeFileSync(join(temporaryRoot, 'smoke.mjs'), smoke);
  execFileSync(process.execPath, [join(temporaryRoot, 'smoke.mjs')], {
    cwd: temporaryRoot,
    stdio: 'inherit',
    timeout: 30000
  });

  const installedPackage = JSON.parse(readFileSync(
    join(temporaryRoot, 'node_modules', 'app-store-scraper-mcp', 'package.json'),
    'utf8'
  ));
  assert.equal(installedPackage.version, pack.version);
  console.log(`Package smoke test passed for ${pack.name}@${pack.version}.`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
