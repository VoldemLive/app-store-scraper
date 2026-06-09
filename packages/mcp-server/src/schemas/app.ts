import { z } from 'zod';

export const AppSchema = z.object({
  id: z.number(),
  appId: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  genres: z.array(z.string()),
  genreIds: z.array(z.string()),
  primaryGenre: z.string(),
  primaryGenreId: z.number(),
  contentRating: z.string(),
  languages: z.array(z.string()).nullish(),
  size: z.string().optional(),
  requiredOsVersion: z.string().optional(),
  released: z.string(),
  updated: z.string(),
  releaseNotes: z.string().optional(),
  version: z.string(),
  price: z.number(),
  currency: z.string(),
  free: z.boolean(),
  developerId: z.number(),
  developer: z.string(),
  developerUrl: z.string(),
  developerWebsite: z.string().optional(),
  score: z.number().optional(),
  reviews: z.number().optional(),
  currentVersionScore: z.number().optional(),
  currentVersionReviews: z.number().optional(),
  screenshots: z.array(z.string()),
  ipadScreenshots: z.array(z.string()),
  appletvScreenshots: z.array(z.string()),
  supportedDevices: z.array(z.string())
});

export type App = z.infer<typeof AppSchema>;

export const AppSummarySchema = z.object({
  id: z.number(),
  appId: z.string(),
  title: z.string(),
  icon: z.string(),
  url: z.string().optional(),
  price: z.number(),
  currency: z.string(),
  free: z.boolean(),
  description: z.string().optional(),
  developer: z.string(),
  developerUrl: z.string().optional(),
  developerId: z.number().optional(),
  genre: z.string(),
  genreId: z.number(),
  released: z.string()
});

export type AppSummary = z.infer<typeof AppSummarySchema>;
