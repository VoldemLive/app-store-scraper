import assert from 'node:assert/strict';
import test from 'node:test';
import { AppStoreScraperAdapter, type AppStoreScraper } from '../../../src/providers/app-store/index.js';
import { ProviderError, ErrorCode } from '../../../src/errors/index.js';
import type { App, AppSummary, Review, Ratings, PrivacyDetails, Suggestion, VersionHistoryItem } from '../../../src/schemas/index.js';
import { loadConfig } from '../../../src/config.js';

const validApp: App = {
  id: 1234,
  appId: 'com.example.app',
  title: 'Example App',
  url: 'https://apps.apple.com/app/id1234',
  genres: ['Utilities'],
  genreIds: ['6002'],
  primaryGenre: 'Utilities',
  primaryGenreId: 6002,
  contentRating: '4+',
  languages: ['EN'],
  released: '2020-01-01',
  updated: '2024-01-01',
  version: '1.0.0',
  price: 0,
  currency: 'USD',
  free: true,
  developerId: 9999,
  developer: 'Example Dev',
  developerUrl: 'https://itunes.apple.com/developer/id9999',
  screenshots: [],
  ipadScreenshots: [],
  appletvScreenshots: [],
  supportedDevices: []
};

const rawStringApp = {
  ...validApp,
  id: '1234',
  primaryGenreId: '6002',
  price: '0',
  developerId: '9999',
  score: '4.5',
  reviews: '125'
};

const validSummary: AppSummary = {
  id: 1234,
  appId: 'com.example.app',
  title: 'Example App',
  icon: 'https://example.com/icon.png',
  price: 0,
  currency: 'USD',
  free: true,
  developer: 'Example Dev',
  genre: 'Utilities',
  genreId: 6002,
  released: '2020-01-01'
};

const validReview: Review = {
  id: 'r1',
  userName: 'user',
  userUrl: 'https://itunes.apple.com/user',
  version: '1.0',
  score: 5,
  title: 'Great',
  text: 'Amazing app',
  url: 'https://itunes.apple.com/review/1',
  updated: '2024-01-01T00:00:00Z'
};

const validRatings: Ratings = {
  ratings: 1000,
  histogram: { '1': 10, '2': 20, '3': 50, '4': 200, '5': 720 }
};

const validPrivacy: PrivacyDetails = {
  managePrivacyChoicesUrl: null,
  privacyTypes: [{
    privacyType: 'Data Not Collected',
    identifier: 'DATA_NOT_COLLECTED',
    dataCategories: [],
    purposes: []
  }]
};

const validSuggestion: Suggestion = { term: 'calculator' };

const validVersionItem: VersionHistoryItem = {
  versionDisplay: '1.0.0',
  releaseDate: '2024-01-01',
  releaseTimestamp: '2024-01-01T00:00:00.000Z'
};

function makeScraper (overrides: Partial<AppStoreScraper> = {}): AppStoreScraper {
  const noop = () => Promise.resolve({});
  return {
    app: noop,
    list: noop,
    search: noop,
    developer: noop,
    privacy: noop,
    suggest: noop,
    similar: noop,
    reviews: noop,
    ratings: noop,
    versionHistory: noop,
    ...overrides
  };
}

test('getApp delegates to scraper and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.resolve(validApp) })
  );
  const result = await adapter.getApp({ id: 1234 });
  assert.equal(result.id, 1234);
  assert.equal(result.appId, 'com.example.app');
});

test('getApp normalizes numeric scraper strings before validation', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.resolve(rawStringApp) })
  );
  const result = await adapter.getApp({ id: 1234 });
  assert.equal(result.id, 1234);
  assert.equal(result.price, 0);
  assert.equal(result.developerId, 9999);
  assert.equal(result.score, 4.5);
  assert.equal(result.reviews, 125);
});

test('getApp maps not-found error to NOT_FOUND', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.reject(new Error('App not found (404)')) })
  );
  await assert.rejects(
    () => adapter.getApp({ id: 99999 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.NOT_FOUND && !e.retryable
  );
});

test('getApp maps validation error to INVALID_ARGUMENT', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.reject(new Error('Either id or appId is required')) })
  );
  await assert.rejects(
    () => adapter.getApp({}),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.INVALID_ARGUMENT
  );
});

test('getApp maps timeout error to UPSTREAM_TIMEOUT', async () => {
  const err = Object.assign(new Error('Request timed out after 10000ms'), { code: 'ETIMEDOUT' });
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.reject(err) })
  );
  await assert.rejects(
    () => adapter.getApp({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_TIMEOUT && e.retryable
  );
});

test('getApp maps rate-limit error to UPSTREAM_RATE_LIMITED', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.reject(new Error('429 Too Many Requests')) })
  );
  await assert.rejects(
    () => adapter.getApp({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_RATE_LIMITED && e.retryable
  );
});

test('getApp maps unexpected response shape to UPSTREAM_CHANGED', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.resolve({ unexpected: true }) })
  );
  await assert.rejects(
    () => adapter.getApp({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_CHANGED
  );
});

test('getApp rejects non-numeric values after normalization', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ app: () => Promise.resolve({ ...rawStringApp, id: 'not-an-id' }) })
  );
  await assert.rejects(
    () => adapter.getApp({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_CHANGED
  );
});

test('listApps returns AppSummary[] by default', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ list: () => Promise.resolve([validSummary]) })
  );
  const result = await adapter.listApps({});
  assert.equal(result.length, 1);
});

test('listApps normalizes numeric summary values and identifiers', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({
      list: () => Promise.resolve([{
        ...validSummary,
        id: '1234',
        price: '1.99',
        developerId: '9999',
        genreId: '6002'
      }])
    })
  );
  const [result] = await adapter.listApps({});
  assert.ok(result !== undefined);
  assert.equal(result.id, 1234);
  assert.equal(result.price, 1.99);
  assert.equal(result.developerId, 9999);
  assert.ok('genreId' in result);
  assert.equal(result.genreId, 6002);
});

test('listApps returns App[] when fullDetail is true', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ list: () => Promise.resolve([rawStringApp]) })
  );
  const result = await adapter.listApps({ fullDetail: true }) as App[];
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 1234);
});

test('searchApps returns App[] by default', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ search: () => Promise.resolve([rawStringApp]) })
  );
  const result = await adapter.searchApps({ term: 'test' }) as App[];
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 1234);
});

test('searchApps returns number[] when idsOnly is true', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ search: () => Promise.resolve(['1234', '5678']) })
  );
  const result = await adapter.searchApps({ term: 'test', idsOnly: true });
  assert.deepEqual(result, [1234, 5678]);
});

test('searchApps maps validation error to INVALID_ARGUMENT', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ search: () => Promise.reject(new Error('term is required')) })
  );
  await assert.rejects(
    () => adapter.searchApps({ term: '' }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.INVALID_ARGUMENT
  );
});

test('searchApps maps unsupported country errors to INVALID_ARGUMENT', async () => {
  const adapter = new AppStoreScraperAdapter(makeScraper({
    search: () => Promise.reject(new Error('Unsupported country code zz'))
  }));

  await assert.rejects(
    adapter.searchApps({ term: 'calendar', country: 'zz' }),
    (error: ProviderError) => error.code === ErrorCode.INVALID_ARGUMENT
  );
});

test('getDeveloperApps delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ developer: () => Promise.resolve([validApp]) })
  );
  const result = await adapter.getDeveloperApps({ devId: 9999 });
  assert.equal(result.length, 1);
});

test('getDeveloperApps maps not-found to NOT_FOUND', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ developer: () => Promise.reject(new Error('Developer not found (404)')) })
  );
  await assert.rejects(
    () => adapter.getDeveloperApps({ devId: 0 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.NOT_FOUND
  );
});

test('getPrivacy delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ privacy: () => Promise.resolve(validPrivacy) })
  );
  const result = await adapter.getPrivacy({ id: 1234 });
  assert.equal(result.privacyTypes.length, 1);
});

test('getPrivacy maps upstream-format error to UPSTREAM_CHANGED', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ privacy: () => Promise.reject(new Error('Privacy details not found')) })
  );
  await assert.rejects(
    () => adapter.getPrivacy({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_CHANGED
  );
});

test('getSuggestions delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ suggest: () => Promise.resolve([validSuggestion]) })
  );
  const result = await adapter.getSuggestions({ term: 'calc' });
  assert.equal(result.length, 1);
  const first = result[0];
  assert.ok(first);
  assert.equal(first.term, 'calculator');
});

test('getSimilarApps delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ similar: () => Promise.resolve([validApp]) })
  );
  const result = await adapter.getSimilarApps({ id: 1234 });
  assert.equal(result.length, 1);
});

test('getReviews delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ reviews: () => Promise.resolve([validReview]) })
  );
  const result = await adapter.getReviews({ id: 1234 });
  assert.equal(result.length, 1);
  const first = result[0];
  assert.ok(first);
  assert.equal(first.score, 5);
});

test('getRatings delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ ratings: () => Promise.resolve(validRatings) })
  );
  const result = await adapter.getRatings({ id: 1234 });
  assert.equal(result.ratings, 1000);
});

test('getVersionHistory delegates and parses result', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ versionHistory: () => Promise.resolve([validVersionItem]) })
  );
  const result = await adapter.getVersionHistory({ id: 1234 });
  assert.equal(result.length, 1);
  const first = result[0];
  assert.ok(first);
  assert.equal(first.versionDisplay, '1.0.0');
});

test('getVersionHistory maps upstream-format error to UPSTREAM_CHANGED', async () => {
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ versionHistory: () => Promise.reject(new Error('Version history not found')) })
  );
  await assert.rejects(
    () => adapter.getVersionHistory({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_CHANGED && !e.retryable
  );
});

test('applies configured network policy and shares cached results', async () => {
  const config = loadConfig({
    MCP_REQUEST_TIMEOUT_MS: '1500',
    MCP_REQUEST_RETRIES: '1',
    MCP_REQUEST_RETRY_DELAY_MS: '50',
    MCP_REQUEST_MAX_RETRY_DELAY_MS: '500',
    MCP_REQUEST_THROTTLE_RPS: '4',
    MCP_CACHE_TTL_MS: '60000',
    MCP_CACHE_MAX_ENTRIES: '10'
  });
  const controller = new AbortController();
  let calls = 0;
  let received: Record<string, unknown> | undefined;
  const adapter = new AppStoreScraperAdapter(
    makeScraper({
      app: opts => {
        calls++;
        received = opts;
        return Promise.resolve(validApp);
      }
    }),
    config
  );

  await adapter.getApp({ id: 1234 }, { signal: controller.signal });
  await adapter.getApp({ id: 1234 }, { signal: controller.signal });

  assert.equal(calls, 1);
  assert.equal(received?.['throttle'], 4);
  assert.deepEqual(received?.['requestOptions'], {
    timeout: 1500,
    retries: 1,
    retryDelay: 50,
    maxRetryDelay: 500,
    signal: controller.signal
  });
});

test('returns CANCELLED before calling scraper for an aborted operation', async () => {
  const config = loadConfig({});
  const controller = new AbortController();
  controller.abort();
  let called = false;
  const adapter = new AppStoreScraperAdapter(
    makeScraper({
      app: () => {
        called = true;
        return Promise.resolve(validApp);
      }
    }),
    config
  );

  await assert.rejects(
    () => adapter.getApp({ id: 1234 }, { signal: controller.signal }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.CANCELLED
  );
  assert.equal(called, false);
});

test('normalizes ETIMEDOUT code on network errors', async () => {
  const err = new Error('socket hang up') as Error & { code?: string };
  err.code = 'ETIMEDOUT';
  const adapter = new AppStoreScraperAdapter(
    makeScraper({ ratings: () => Promise.reject(err) })
  );
  await assert.rejects(
    () => adapter.getRatings({ id: 1234 }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.UPSTREAM_TIMEOUT
  );
});
