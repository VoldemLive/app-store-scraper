import { z } from 'zod';
import { ProviderError, ErrorCode } from '../../errors/index.js';
import { AppSchema, AppSummarySchema } from '../../schemas/app.js';
import { ReviewSchema } from '../../schemas/review.js';
import { RatingsSchema } from '../../schemas/ratings.js';
import { PrivacyDetailsSchema } from '../../schemas/privacy.js';
import { SuggestionSchema } from '../../schemas/suggest.js';
import { VersionHistoryItemSchema } from '../../schemas/version-history.js';
import type { AppStoreProvider, GetAppInput, ListAppsInput, SearchAppsInput, DeveloperAppsInput, AppIdInput, AppIdentifierInput, SuggestInput, ReviewsInput } from './types.js';
import type { App, AppSummary, Review, Ratings, PrivacyDetails, Suggestion, VersionHistoryItem } from '../../schemas/index.js';

type ScraperFn = (opts: Record<string, unknown>) => Promise<unknown>;

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

  if (code === 'ETIMEDOUT' || msg.toLowerCase().includes('timed out')) {
    return new ProviderError(ErrorCode.UPSTREAM_TIMEOUT, 'Request timed out', true);
  }

  if (msg.includes('429') || /rate.?limit/i.test(msg)) {
    return new ProviderError(ErrorCode.UPSTREAM_RATE_LIMITED, 'Rate limited by upstream', true);
  }

  if (/Version history not found|Privacy details not found|Unable to parse/i.test(msg)) {
    return new ProviderError(ErrorCode.UPSTREAM_CHANGED, msg, false);
  }

  if (/(App|Developer) not found|App not found.*404|404/i.test(msg)) {
    return new ProviderError(ErrorCode.NOT_FOUND, msg, false);
  }

  if (/required|must be|invalid|cannot retrieve|more than|missing/i.test(msg)) {
    return new ProviderError(ErrorCode.INVALID_ARGUMENT, msg, false);
  }

  return new ProviderError(ErrorCode.INTERNAL_ERROR, 'Unexpected provider failure', false);
}

async function callScraper<T> (
  fn: ScraperFn,
  opts: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await fn(opts);
  } catch (error) {
    throw normalizeError(error);
  }

  const parsed = schema.safeParse(raw);
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
  constructor (private readonly scraper: AppStoreScraper) {}

  getApp (input: GetAppInput): Promise<App> {
    return callScraper(
      this.scraper.app,
      input as Record<string, unknown>,
      AppSchema
    );
  }

  listApps (input: ListAppsInput): Promise<AppSummary[] | App[]> {
    if (input.fullDetail === true) {
      return callScraper(
        this.scraper.list,
        input as Record<string, unknown>,
        z.array(AppSchema)
      );
    }
    return callScraper(
      this.scraper.list,
      input as Record<string, unknown>,
      z.array(AppSummarySchema)
    );
  }

  searchApps (input: SearchAppsInput): Promise<App[] | number[]> {
    if (input.idsOnly === true) {
      return callScraper(
        this.scraper.search,
        input as Record<string, unknown>,
        z.array(z.number())
      );
    }
    return callScraper(
      this.scraper.search,
      input as Record<string, unknown>,
      z.array(AppSchema)
    );
  }

  getDeveloperApps (input: DeveloperAppsInput): Promise<App[]> {
    return callScraper(
      this.scraper.developer,
      input as Record<string, unknown>,
      z.array(AppSchema)
    );
  }

  getPrivacy (input: AppIdInput): Promise<PrivacyDetails> {
    return callScraper(
      this.scraper.privacy,
      input as Record<string, unknown>,
      PrivacyDetailsSchema
    );
  }

  getSuggestions (input: SuggestInput): Promise<Suggestion[]> {
    return callScraper(
      this.scraper.suggest,
      input as Record<string, unknown>,
      z.array(SuggestionSchema)
    );
  }

  getSimilarApps (input: AppIdentifierInput): Promise<App[]> {
    return callScraper(
      this.scraper.similar,
      input as Record<string, unknown>,
      z.array(AppSchema)
    );
  }

  getReviews (input: ReviewsInput): Promise<Review[]> {
    return callScraper(
      this.scraper.reviews,
      input as Record<string, unknown>,
      z.array(ReviewSchema)
    );
  }

  getRatings (input: AppIdInput): Promise<Ratings> {
    return callScraper(
      this.scraper.ratings,
      input as Record<string, unknown>,
      RatingsSchema
    );
  }

  getVersionHistory (input: AppIdInput): Promise<VersionHistoryItem[]> {
    return callScraper(
      this.scraper.versionHistory,
      input as Record<string, unknown>,
      z.array(VersionHistoryItemSchema)
    );
  }

  static async create (): Promise<AppStoreScraperAdapter> {
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
    return new AppStoreScraperAdapter(scraper);
  }
}
