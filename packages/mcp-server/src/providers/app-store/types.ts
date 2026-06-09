import type { App, AppSummary, Review, Ratings, PrivacyDetails, Suggestion, VersionHistoryItem } from '../../schemas/index.js';

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
  getApp(input: GetAppInput): Promise<App>;
  listApps(input: ListAppsInput): Promise<AppSummary[] | App[]>;
  searchApps(input: SearchAppsInput): Promise<App[] | number[]>;
  getDeveloperApps(input: DeveloperAppsInput): Promise<App[]>;
  getPrivacy(input: AppIdInput): Promise<PrivacyDetails>;
  getSuggestions(input: SuggestInput): Promise<Suggestion[]>;
  getSimilarApps(input: AppIdentifierInput): Promise<App[]>;
  getReviews(input: ReviewsInput): Promise<Review[]>;
  getRatings(input: AppIdInput): Promise<Ratings>;
  getVersionHistory(input: AppIdInput): Promise<VersionHistoryItem[]>;
}
