import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assert } from 'chai';

const scanner = join(process.cwd(), 'scripts/check-secrets.js');

function runScanner (files) {
  return spawnSync(process.execPath, [scanner, ...files], {
    encoding: 'utf8'
  });
}

describe('Secret scanner', () => {
  it('accepts tracked repository files', () => {
    const result = spawnSync(process.execPath, [scanner], {
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects a representative private key without storing one', () => {
    const directory = mkdtempSync(join(tmpdir(), 'app-store-scraper-secret-test-'));
    const file = join(directory, 'credential.txt');
    const marker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    writeFileSync(file, `${marker}\nsynthetic-test-value\n`);

    const result = runScanner([file]);

    assert.equal(result.status, 1);
    assert.include(result.stderr, 'private key');
  });

  it('rejects a representative assigned token without storing one', () => {
    const directory = mkdtempSync(join(tmpdir(), 'app-store-scraper-secret-test-'));
    const file = join(directory, 'credential.txt');
    const field = ['access', 'token'].join('_');
    writeFileSync(file, `${field}=synthetic0123456789token\n`);

    const result = runScanner([file]);

    assert.equal(result.status, 1);
    assert.include(result.stderr, 'assigned access token');
  });

  it('keeps the history free of tracked credential filenames', () => {
    const output = execFileSync(
      'git',
      ['log', '--all', '--name-only', '--pretty=format:', '--', '*.pem', '*.key', '*.p8', '*.p12'],
      { encoding: 'utf8' }
    );

    assert.equal(output.trim(), '');
  });
});
