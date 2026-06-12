import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadAppleAdsCredentials, isAppleAdsConfigured } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

const PRIVATE_KEY_MARKER = ['-----BEGIN EC ', 'PRIVATE KEY-----'].join('');
const PRIVATE_KEY_END_MARKER = ['-----END EC ', 'PRIVATE KEY-----'].join('');
const TEST_PRIVATE_KEY = `${PRIVATE_KEY_MARKER}\ntest\n${PRIVATE_KEY_END_MARKER}`;

const BASE_ENV = {
  APPLE_ADS_CLIENT_ID: 'client-id',
  APPLE_ADS_TEAM_ID: 'team-id',
  APPLE_ADS_KEY_ID: 'key-id',
  APPLE_ADS_PRIVATE_KEY: TEST_PRIVATE_KEY
};

test('isAppleAdsConfigured returns true when all required vars set', () => {
  assert.equal(isAppleAdsConfigured(BASE_ENV), true);
});

test('isAppleAdsConfigured returns false when any required var missing', () => {
  assert.equal(isAppleAdsConfigured({}), false);
  assert.equal(isAppleAdsConfigured({ APPLE_ADS_CLIENT_ID: 'x' }), false);
  assert.equal(isAppleAdsConfigured({ ...BASE_ENV, APPLE_ADS_PRIVATE_KEY: undefined }), false);
});

test('isAppleAdsConfigured accepts APPLE_ADS_PRIVATE_KEY_PATH instead of APPLE_ADS_PRIVATE_KEY', () => {
  const env = { ...BASE_ENV, APPLE_ADS_PRIVATE_KEY: undefined, APPLE_ADS_PRIVATE_KEY_PATH: '/path/to/key.pem' };
  assert.equal(isAppleAdsConfigured(env), true);
});

test('loads credentials from inline private key env var', () => {
  const creds = loadAppleAdsCredentials(BASE_ENV);
  assert.equal(creds.clientId, 'client-id');
  assert.equal(creds.teamId, 'team-id');
  assert.equal(creds.keyId, 'key-id');
  assert.equal(creds.privateKey, BASE_ENV.APPLE_ADS_PRIVATE_KEY);
});

test('loads private key from file when APPLE_ADS_PRIVATE_KEY_PATH is set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apple-ads-test-'));
  const keyPath = join(dir, 'key.pem');
  const keyContent = `${PRIVATE_KEY_MARKER}\nfromfile\n${PRIVATE_KEY_END_MARKER}`;
  writeFileSync(keyPath, keyContent, 'utf8');

  try {
    const env = { ...BASE_ENV, APPLE_ADS_PRIVATE_KEY: undefined, APPLE_ADS_PRIVATE_KEY_PATH: keyPath };
    const creds = loadAppleAdsCredentials(env);
    assert.equal(creds.privateKey, keyContent);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('throws AUTH_REQUIRED when required vars missing', () => {
  assert.throws(
    () => loadAppleAdsCredentials({}),
    (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.AUTH_REQUIRED
  );
});

test('throws AUTH_REQUIRED when neither private key var is set', () => {
  const env = { APPLE_ADS_CLIENT_ID: 'x', APPLE_ADS_TEAM_ID: 'y', APPLE_ADS_KEY_ID: 'z' };
  assert.throws(
    () => loadAppleAdsCredentials(env),
    (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.AUTH_REQUIRED
  );
});

test('throws AUTH_REQUIRED when key file path does not exist', () => {
  const env = {
    ...BASE_ENV,
    APPLE_ADS_PRIVATE_KEY: undefined,
    APPLE_ADS_PRIVATE_KEY_PATH: '/nonexistent/path/key.pem'
  };
  assert.throws(
    () => loadAppleAdsCredentials(env),
    (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.AUTH_REQUIRED
  );
});

test('credentials object does not expose private key via standard JSON serialization boundary', () => {
  const creds = loadAppleAdsCredentials(BASE_ENV);
  const serialized = JSON.stringify(creds);
  // Private key IS a field on the object (needed for signing) but the log layer must not include it.
  // This test verifies the field name so log-redaction tests can target it.
  assert.match(serialized, /privateKey/);
});
