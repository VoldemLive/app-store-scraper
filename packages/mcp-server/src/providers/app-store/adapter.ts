import { z } from 'zod';
import { ProviderError, ErrorCode } from '../../errors/index.js';
import { AppSchema, AppSummarySchema } from '../../schemas/app.js';
import { ReviewSchema } from '../../schemas/review.js';
import { RatingsSchema } from '../../schemas/ratings.js';
import { PrivacyDetailsSchema } from '../../schemas/privacy.js';
import { SuggestionSchema } from '../../schemas/suggest.js';
import { VersionHistoryItemSchema } from '../../schemas/version-history.js';
import type { ServerConfig } from '../../config.js';
import type { AppStoreProvider, ProviderCallContext, GetAppInput, ListAppsInput, SearchAppsInput, DeveloperAppsInput, AppIdInput, AppIdentifierInput, SuggestInput, ReviewsInput } from './types.js';
import type { App, AppSummary, Review, Ratings, PrivacyDetails, Suggestion, VersionHistoryItem } from '../../schemas/index.js';

type ScraperFn = (opts: Record<string, unknown>) => Promise<unknown>;
type CacheEntry = { expiresAt: number; value: unknown };
type Normalizer = (raw: unknown) => unknown;

const APP_NUMBER_FIELDS = [
  'id', 'primaryGenreId', 'price', 'developerId', 'score', 'reviews',
  'currentVersionScore', 'currentVersionReviews'
];

export interface AppStoreScraper {
  app: ScraperFn;
  list: ScraperFn;
  search: ScraperFn;
  developer: ScraperFn;
  privacy: ScraperFn;
  suggest: ScraperFn;
  similar: ScraperFn;
  reviews: ScraperFn;
  ratings: ScraperFn;
  versionHistory: ScraperFn;
}

function normalizeError (error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;

  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string }).code;

  if (code === 'ABORT_ERR' || (error instanceof Error && error.name === 'AbortError')) {
    return new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
  }

  if (code === 'ETIMEDOUT' || msg.toLowerCase().includes('timed out')) {
    return new ProviderError(ErrorCode.UPSTREAM_TIMEOUT, 'Request timed out', true);
  }

  if (msg.includes('429') || /rate.?limit/i.test(msg)) {
    return new ProviderError(ErrorCode.UPSTREAM_RATE_LIMITED, 'Rate limited by upstream', true);
  }

  if (/Version history not found|Privacy details not found|Unable to parse/i.test(msg)) {
    return new ProviderError(ErrorCode.UPSTREAM_CHANGED, msg, false);
  }

  if (/(App|Developer) not found/i.test(msg)) {
    return new ProviderError(ErrorCode.NOT_FOUND, msg, false);
  }

  if (/required|must be|invalid|unsupported|cannot retrieve|more than|missing/i.test(msg)) {
    return new ProviderError(ErrorCode.INVALID_ARGUMENT, msg, false);
  }

  return new ProviderError(ErrorCode.INTERNAL_ERROR, 'Unexpected provider failure', false);
}

function normalizeNumber (value: unknown): unknown {
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
}

function normalizeNumberFields (value: unknown, fields: string[]): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;

  const normalized = { ...(value as Record<string, unknown>) };
  fields.forEach(field => {
    if (Object.hasOwn(normalized, field)) normalized[field] = normalizeNumber(normalized[field]);
  });
  return normalized;
}

const normalizeApp = (value: unknown) => normalizeNumberFields(value, APP_NUMBER_FIELDS);
const normalizeSummary = (value: unknown) => normalizeNumberFields(value, ['id', 'price', 'developerId', 'genreId']);
const normalizeArray = (normalizeItem: Normalizer): Normalizer => raw => (
  Array.isArray(raw) ? raw.map(normalizeItem) : raw
);
const normalizeAppIds = normalizeArray(normalizeNumber);

async function callScraper<T> (
  fn: ScraperFn,
  opts: Record<string, unknown>,
  schema: z.ZodType<T>,
  normalize: Normalizer = raw => raw
): Promise<T> {
  let raw: unknown;
  try {
    raw = await fn(opts);
  } catch (error) {
    throw normalizeError(error);
  }

  const parsed = schema.safeParse(normalize(raw));
  if (!parsed.success) {
    throw new ProviderError(
      ErrorCode.UPSTREAM_CHANGED,
      'Upstream response format changed',
      false
    );
  }
  return parsed.data;
}

export class AppStoreScraperAdapter implements AppStoreProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor (
    private readonly scraper: AppStoreScraper,
    private readonly controls?: Pick<ServerConfig, 'request' | 'cache'>
  ) {}

  private options (
    input: Record<string, unknown>,
    context?: ProviderCallContext
  ): Record<string, unknown> {
    if (this.controls === undefined) return input;
    return {
      ...input,
      requestOptions: {
        timeout: this.controls.request.timeoutMs,
        retries: this.controls.request.retries,
        retryDelay: this.controls.request.retryDelayMs,
        maxRetryDelay: this.controls.request.maxRetryDelayMs,
        ...(context?.signal !== undefined && { signal: context.signal })
      },
      throttle: this.controls.request.throttleRps
    };
  }

  private async cached<T> (
    operation: string,
    input: Record<string, unknown>,
    context: ProviderCallContext | undefined,
    load: (opts: Record<string, unknown>) => Promise<T>
  ): Promise<T> {
    if (context?.signal?.aborted) {
      throw new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
    }
    const cache = this.controls?.cache;
    if (cache === undefined || cache.ttlMs === 0 || cache.maxEntries === 0) {
      return load(this.options(input, context));
    }

    const key = `${operation}:${JSON.stringify(input)}`;
    const existing = this.cache.get(key);
    if (existing !== undefined && existing.expiresAt > Date.now()) {
      return existing.value as T;
    }
    if (existing !== undefined) this.cache.delete(key);

    const value = await load(this.options(input, context));
    while (this.cache.size >= cache.maxEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: Date.now() + cache.ttlMs, value });
    return value;
  }

  getApp (input: GetAppInput, context?: ProviderCallContext): Promise<App> {
    return this.cached('getApp', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.app,
      opts,
      AppSchema,
      normalizeApp
    ));
  }

  listApps (input: ListAppsInput, context?: ProviderCallContext): Promise<AppSummary[] | App[]> {
    if (input.fullDetail === true) {
      return this.cached('listApps', input as Record<string, unknown>, context, opts => callScraper(
        this.scraper.list,
        opts,
        z.array(AppSchema),
        normalizeArray(normalizeApp)
      ));
    }
    return this.cached('listApps', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.list,
      opts,
      z.array(AppSummarySchema),
      normalizeArray(normalizeSummary)
    ));
  }

  searchApps (input: SearchAppsInput, context?: ProviderCallContext): Promise<App[] | number[]> {
    if (input.idsOnly === true) {
      return this.cached('searchApps', input as Record<string, unknown>, context, opts => callScraper(
        this.scraper.search,
        opts,
        z.array(z.number().int().positive()),
        normalizeAppIds
      ));
    }
    return this.cached('searchApps', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.search,
      opts,
      z.array(AppSchema),
      normalizeArray(normalizeApp)
    ));
  }

  getDeveloperApps (input: DeveloperAppsInput, context?: ProviderCallContext): Promise<App[]> {
    return this.cached('getDeveloperApps', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.developer,
      opts,
      z.array(AppSchema),
      normalizeArray(normalizeApp)
    ));
  }

  getPrivacy (input: AppIdInput, context?: ProviderCallContext): Promise<PrivacyDetails> {
    return this.cached('getPrivacy', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.privacy,
      opts,
      PrivacyDetailsSchema
    ));
  }

  getSuggestions (input: SuggestInput, context?: ProviderCallContext): Promise<Suggestion[]> {
    return this.cached('getSuggestions', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.suggest,
      opts,
      z.array(SuggestionSchema)
    ));
  }

  getSimilarApps (input: AppIdentifierInput, context?: ProviderCallContext): Promise<App[]> {
    return this.cached('getSimilarApps', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.similar,
      opts,
      z.array(AppSchema),
      normalizeArray(normalizeApp)
    ));
  }

  getReviews (input: ReviewsInput, context?: ProviderCallContext): Promise<Review[]> {
    return this.cached('getReviews', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.reviews,
      opts,
      z.array(ReviewSchema)
    ));
  }

  getRatings (input: AppIdInput, context?: ProviderCallContext): Promise<Ratings> {
    return this.cached('getRatings', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.ratings,
      opts,
      RatingsSchema
    ));
  }

  getVersionHistory (input: AppIdInput, context?: ProviderCallContext): Promise<VersionHistoryItem[]> {
    return this.cached('getVersionHistory', input as Record<string, unknown>, context, opts => callScraper(
      this.scraper.versionHistory,
      opts,
      z.array(VersionHistoryItemSchema)
    ));
  }

  static async create (
    controls?: Pick<ServerConfig, 'request' | 'cache'>
  ): Promise<AppStoreScraperAdapter> {
    const mod = await import('app-store-scraper') as Record<string, unknown>;
    const scraper: AppStoreScraper = {
      app: mod['app'] as ScraperFn,
      list: mod['list'] as ScraperFn,
      search: mod['search'] as ScraperFn,
      developer: mod['developer'] as ScraperFn,
      privacy: mod['privacy'] as ScraperFn,
      suggest: mod['suggest'] as ScraperFn,
      similar: mod['similar'] as ScraperFn,
      reviews: mod['reviews'] as ScraperFn,
      ratings: mod['ratings'] as ScraperFn,
      versionHistory: mod['versionHistory'] as ScraperFn
    };
    return new AppStoreScraperAdapter(scraper, controls);
  }
}
