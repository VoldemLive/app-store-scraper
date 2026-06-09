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
}
