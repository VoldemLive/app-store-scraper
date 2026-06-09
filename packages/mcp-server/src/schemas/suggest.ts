import { z } from 'zod';

export const SuggestionSchema = z.object({
  term: z.string()
});

export type Suggestion = z.infer<typeof SuggestionSchema>;
