import assert from 'node:assert/strict';
import test from 'node:test';
import { AppleAdsHttpClient } from '../../../src/providers/apple-ads/index.js';
import type { AppleAdsOAuthClient } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

const TEST_BASE_URL = 'https://test.searchads.example.com/api/v5';

function makeOAuthClient (token = 'test-token'): AppleAdsOAuthClient {
  return {
    getAccessToken: async () => token,
    invalidate: () => {}
  } as unknown as AppleAdsOAuthClient;
}

function makeHttpClient (oauthClient = makeOAuthClient()): AppleAdsHttpClient {
  return new AppleAdsHttpClient(oauthClient, TEST_BASE_URL);
}

function mockFetch (response: Response | (() => Response)): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => typeof response === 'function' ? response() : response;
  return () => { globalThis.fetch = originalFetch; };
}

test('GET includes Authorization header with bearer token', async () => {
  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = Object.fromEntries(
      Object.entries(init?.headers as Record<string, string> ?? {})
    );
    return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const client = makeHttpClient();
    await client.get<{ data: unknown[] }>('/campaigns');
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET includes X-AP-Context header when orgId provided', async () => {
  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = Object.fromEntries(
      Object.entries(init?.headers as Record<string, string> ?? {})
    );
    return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const client = makeHttpClient();
    await client.get<{ data: unknown[] }>('/campaigns', { orgId: '12345' });
    assert.equal(capturedHeaders['X-AP-Context'], 'orgId=12345');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET omits X-AP-Context header when orgId not provided', async () => {
  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = Object.fromEntries(
      Object.entries(init?.headers as Record<string, string> ?? {})
    );
    return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const client = makeHttpClient();
    await client.get<{ data: unknown[] }>('/acls');
    assert.ok(!('X-AP-Context' in capturedHeaders));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns parsed JSON on 200 response', async () => {
  const payload = { data: [{ id: 1, name: 'Test' }] };
  const restore = mockFetch(new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  }));
  try {
    const client = makeHttpClient();
    const result = await client.get<typeof payload>('/campaigns');
    assert.deepEqual(result, payload);
  } finally {
    restore();
  }
});

test('throws AUTH_REQUIRED on 401', async () => {
  const restore = mockFetch(new Response('Unauthorized', { status: 401 }));
  try {
    const invalidateCalled = { value: false };
    const oauth = {
      getAccessToken: async () => 'tok',
      invalidate: () => { invalidateCalled.value = true; }
    } as unknown as AppleAdsOAuthClient;
    const client = new AppleAdsHttpClient(oauth, TEST_BASE_URL);
    await assert.rejects(
      () => client.get('/test'),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.AUTH_REQUIRED
    );
  } finally {
    restore();
  }
});

test('throws PERMISSION_DENIED on 403', async () => {
  const restore = mockFetch(new Response('Forbidden', { status: 403 }));
  try {
    const client = makeHttpClient();
    await assert.rejects(
      () => client.get('/test'),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.PERMISSION_DENIED
    );
  } finally {
    restore();
  }
});

test('throws NOT_FOUND on 404', async () => {
  const restore = mockFetch(new Response('Not Found', { status: 404 }));
  try {
    const client = makeHttpClient();
    await assert.rejects(
      () => client.get('/test'),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.NOT_FOUND
    );
  } finally {
    restore();
  }
});

test('throws UPSTREAM_RATE_LIMITED on 429', async () => {
  // Return 429 enough times to exhaust retries
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    callCount++;
    return new Response('Rate Limited', { status: 429 });
  };
  try {
    const client = makeHttpClient();
    await assert.rejects(
      () => client.get('/test'),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.UPSTREAM_RATE_LIMITED
    );
    assert.ok(callCount > 1, 'should retry on 429');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('throws INTERNAL_ERROR on 500', async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    callCount++;
    return new Response('Server Error', { status: 500 });
  };
  try {
    const client = makeHttpClient();
    await assert.rejects(
      () => client.get('/test'),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.INTERNAL_ERROR
    );
    assert.ok(callCount > 1, 'should retry on 500');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalidates token and retries on 401 for first attempt', async () => {
  let callCount = 0;
  let invalidateCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) return new Response('Unauthorized', { status: 401 });
    return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
  };

  const oauth = {
    getAccessToken: async () => 'tok',
    invalidate: () => { invalidateCalled = true; }
  } as unknown as AppleAdsOAuthClient;

  try {
    const client = new AppleAdsHttpClient(oauth, TEST_BASE_URL);
    await client.get<{ data: unknown[] }>('/campaigns');
    assert.ok(invalidateCalled, 'should invalidate token on 401');
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('throws CANCELLED on AbortSignal before request', async () => {
  const restore = mockFetch(new Response(JSON.stringify({ data: [] }), {
    headers: { 'Content-Type': 'application/json' }
  }));
  try {
    const client = makeHttpClient();
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
      () => client.get('/test', { signal: ac.signal }),
      (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.CANCELLED
    );
  } finally {
    restore();
  }
});

test('POST sends body as JSON', async () => {
  let capturedBody: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = init?.body as string ?? null;
    return new Response(JSON.stringify({ data: {} }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const client = makeHttpClient();
    const body = { startTime: '2026-01-01', endTime: '2026-01-31' };
    await client.post<{ data: unknown }>('/reports/campaigns', body);
    assert.deepEqual(JSON.parse(capturedBody!), body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
