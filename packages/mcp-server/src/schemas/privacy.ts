import { z } from 'zod';

const PrivacyCategorySchema = z.object({
  dataCategory: z.string(),
  identifier: z.string(),
  dataTypes: z.array(z.string())
});

const PrivacyPurposeSchema = z.object({
  purpose: z.string(),
  identifier: z.string(),
  dataCategories: z.array(PrivacyCategorySchema)
});

const PrivacyTypeSchema = z.object({
  privacyType: z.string(),
  identifier: z.string(),
  description: z.string().optional(),
  dataCategories: z.array(PrivacyCategorySchema),
  purposes: z.array(PrivacyPurposeSchema)
});

export const PrivacyDetailsSchema = z.object({
  managePrivacyChoicesUrl: z.string().nullable(),
  privacyTypes: z.array(PrivacyTypeSchema)
});

export type PrivacyDetails = z.infer<typeof PrivacyDetailsSchema>;
