import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { AppleAdsOAuthClient, generateClientSecretJwt } from '../../../src/providers/apple-ads/index.js';
import type { AppleAdsCredentials } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

function makeTestCredentials (): AppleAdsCredentials {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  return { clientId: 'client-id', teamId: 'team-id', keyId: 'key-id', privateKey: pem };
}

test('generateClientSecretJwt produces a three-segment JWT', () => {
  const creds = makeTestCredentials();
  const jwt = generateClientSecretJwt(creds);
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);
});

test('generateClientSecretJwt header contains alg:ES256 and kid', () => {
  const creds = makeTestCredentials();
  const jwt = generateClientSecretJwt(creds);
  const [headerB64] = jwt.split('.');
  const header = JSON.parse(Buffer.from(headerB64!, 'base64url').toString('utf8')) as Record<string, unknown>;
  assert.equal(header['alg'], 'ES256');
  assert.equal(header['kid'], 'key-id');
});

test('generateClientSecretJwt payload contains required claims', () => {
  const creds = makeTestCredentials();
  const jwt = generateClientSecretJwt(creds);
  const [, payloadB64] = jwt.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8')) as Record<string, unknown>;
  assert.equal(payload['sub'], 'client-id');
  assert.equal(payload['iss'], 'team-id');
  assert.equal(payload['aud'], 'https://appleid.apple.com');
  assert.ok(typeof payload['iat'] === 'number');
  assert.ok(typeof payload['exp'] === 'number');
  assert.ok((payload['exp'] as number) > (payload['iat'] as number));
});

test('getAccessToken caches token and reuses it on second call', async () => {
  const creds = makeTestCredentials();
  let fetchCount = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
    fetchCount++;
    return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const client = new AppleAdsOAuthClient(creds);
    const t1 = await client.getAccessToken();
    const t2 = await client.getAccessToken();
    assert.equal(t1, 'tok-1');
    assert.equal(t2, 'tok-1');
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getAccessToken fetches a new token after invalidate()', async () => {
  const creds = makeTestCredentials();
  let fetchCount = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
    fetchCount++;
    const token = `tok-${fetchCount}`;
    return new Response(JSON.stringify({ access_token: token, expires_in: 3600 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const client = new AppleAdsOAuthClient(creds);
    const t1 = await client.getAccessToken();
    client.invalidate();
    const t2 = await client.getAccessToken();
    assert.equal(t1, 'tok-1');
    assert.equal(t2, 'tok-2');
    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getAccessToken throws AUTH_REQUIRED on 401 response', async () => {
  const creds = makeTestCredentials();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

  try {
    const client = new AppleAdsOAuthClient(creds);
    await assert.rejects(
      () => client.getAccessToken(),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.AUTH_REQUIRED
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getAccessToken throws PERMISSION_DENIED on 403 response', async () => {
  const creds = makeTestCredentials();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('Forbidden', { status: 403 });

  try {
    const client = new AppleAdsOAuthClient(creds);
    await assert.rejects(
      () => client.getAccessToken(),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.PERMISSION_DENIED
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getAccessToken throws CANCELLED on AbortSignal', async () => {
  const creds = makeTestCredentials();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    return new Response('', { status: 200 });
  };

  try {
    const client = new AppleAdsOAuthClient(creds);
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
      () => client.getAccessToken(ac.signal),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.CANCELLED
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client secret JWT does not appear in credential object stringification (secret redaction guard)', () => {
  const creds = makeTestCredentials();
  const jwt = generateClientSecretJwt(creds);
  // The JWT is ephemeral and must not be stored on the credentials object
  const credStr = JSON.stringify(creds);
  assert.ok(!credStr.includes(jwt), 'Client secret JWT must not be stored in credentials');
});
