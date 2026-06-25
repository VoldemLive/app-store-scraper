declare module 'app-store-scraper' {
  type ScraperFn = (opts: Record<string, unknown>) => Promise<unknown>;

  export const app: ScraperFn;
  export const list: ScraperFn;
  export const search: ScraperFn;
  export const developer: ScraperFn;
  export const privacy: ScraperFn;
  export const suggest: ScraperFn;
  export const similar: ScraperFn;
  export const reviews: ScraperFn;
  export const ratings: ScraperFn;
  export const versionHistory: ScraperFn;

  export const collection: Record<string, string>;
  export const category: Record<string, number>;
  export const device: Record<string, string>;
  export const sort: Record<string, string>;
  export const markets: Record<string, number>;

  export const APP_PAGE_URL_TEMPLATE: string;
  export const LOOKUP_URL: string;
  export const RATINGS_URL_TEMPLATE: string;
  export const REVIEWS_URL_TEMPLATE: string;
  export const RSS_CHARTS_URL: string;
  export const SEARCH_URL: string;
  export const SIMILAR_APPS_URL_TEMPLATE: string;
  export const SUGGEST_URL: string;
}
