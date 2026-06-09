import { z } from 'zod';

export const RatingsSchema = z.object({
  ratings: z.number(),
  histogram: z.record(z.string(), z.number())
});

export type Ratings = z.infer<typeof RatingsSchema>;
