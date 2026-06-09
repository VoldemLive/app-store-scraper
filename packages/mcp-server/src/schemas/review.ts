import { z } from 'zod';

export const ReviewSchema = z.object({
  id: z.string(),
  userName: z.string(),
  userUrl: z.string(),
  version: z.string(),
  score: z.number(),
  title: z.string(),
  text: z.string(),
  url: z.string(),
  updated: z.string()
});

export type Review = z.infer<typeof ReviewSchema>;
