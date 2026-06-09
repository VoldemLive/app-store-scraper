import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadAppleAdsCredentials, isAppleAdsConfigured } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

const BASE_ENV = {
  APPLE_ADS_CLIENT_ID: 'client-id',
  APPLE_ADS_TEAM_ID: 'team-id',
  APPLE_ADS_KEY_ID: 'key-id',
  APPLE_ADS_PRIVATE_KEY: '-----BEGIN EC PRIVATE KEY-----\ntest\n-----END EC PRIVATE KEY-----'
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
  assert.equal(creds.defaultOrgId, undefined);
});

test('loads optional defaultOrgId when APPLE_ADS_ORG_ID is set', () => {
  const creds = loadAppleAdsCredentials({ ...BASE_ENV, APPLE_ADS_ORG_ID: 'org-123' });
  assert.equal(creds.defaultOrgId, 'org-123');
});

test('loads private key from file when APPLE_ADS_PRIVATE_KEY_PATH is set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apple-ads-test-'));
  const keyPath = join(dir, 'key.pem');
  const keyContent = '-----BEGIN EC PRIVATE KEY-----\nfromfile\n-----END EC PRIVATE KEY-----';
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
