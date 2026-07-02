import { z } from 'zod';

export const GenreSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  subcategories: z.array(z.lazy((): z.ZodType => GenreSchema)).optional()
});

export type Genre = z.infer<typeof GenreSchema>;

export const GroupingSectionSchema = z.object({
  name: z.string(),
  roomId: z.string(),
  appCount: z.number(),
  seeAllUrl: z.string().optional()
});

export type GroupingSection = z.infer<typeof GroupingSectionSchema>;

export const GroupingSchema = z.object({
  genreId: z.number(),
  sections: z.array(GroupingSectionSchema)
});

export type Grouping = z.infer<typeof GroupingSchema>;

export const RoomAppSchema = z.object({
  id: z.number(),
  appId: z.string().optional(),
  title: z.string(),
  developer: z.string().optional(),
  icon: z.string().optional(),
  url: z.string().optional()
});

export type RoomApp = z.infer<typeof RoomAppSchema>;
