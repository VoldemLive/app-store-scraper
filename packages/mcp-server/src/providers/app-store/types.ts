import type { App, AppSummary, Review, Ratings, PrivacyDetails, Suggestion, VersionHistoryItem } from '../../schemas/index.js';
import type { ProviderCallContext } from '../types.js';
export type { ProviderCallContext } from '../types.js';

export type GetAppInput = {
  id?: number;
  appId?: string;
  country?: string;
  lang?: string;
  ratings?: boolean;
};

export type ListAppsInput = {
  collection?: string;
  category?: number;
  country?: string;
  lang?: string;
  num?: number;
  fullDetail?: boolean;
};

export type SearchAppsInput = {
  term: string;
  num?: number;
  page?: number;
  country?: string;
  lang?: string;
  idsOnly?: boolean;
};

export type DeveloperAppsInput = {
  devId: string | number;
  country?: string;
  lang?: string;
};

export type AppIdInput = {
  id: number;
  country?: string;
};

export type AppIdentifierInput = {
  id?: number;
  appId?: string;
  country?: string;
  lang?: string;
};

export type SuggestInput = {
  term: string;
  country?: string;
};

export type ReviewsInput = {
  id?: number;
  appId?: string;
  country?: string;
  page?: number;
  sort?: string;
};

export interface AppStoreProvider {
  getApp(input: GetAppInput, context?: ProviderCallContext): Promise<App>;
  listApps(input: ListAppsInput, context?: ProviderCallContext): Promise<AppSummary[] | App[]>;
  searchApps(input: SearchAppsInput, context?: ProviderCallContext): Promise<App[] | number[]>;
  getDeveloperApps(input: DeveloperAppsInput, context?: ProviderCallContext): Promise<App[]>;
  getPrivacy(input: AppIdInput, context?: ProviderCallContext): Promise<PrivacyDetails>;
  getSuggestions(input: SuggestInput, context?: ProviderCallContext): Promise<Suggestion[]>;
  getSimilarApps(input: AppIdentifierInput, context?: ProviderCallContext): Promise<App[]>;
  getReviews(input: ReviewsInput, context?: ProviderCallContext): Promise<Review[]>;
  getRatings(input: AppIdInput, context?: ProviderCallContext): Promise<Ratings>;
  getVersionHistory(input: AppIdInput, context?: ProviderCallContext): Promise<VersionHistoryItem[]>;
}
