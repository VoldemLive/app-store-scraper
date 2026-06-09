import { z } from 'zod';

export const VersionHistoryItemSchema = z.object({
  versionDisplay: z.string(),
  releaseNotes: z.string().optional(),
  releaseDate: z.string(),
  releaseTimestamp: z.string()
});

export type VersionHistoryItem = z.infer<typeof VersionHistoryItemSchema>;
