import { z } from 'zod';

const identifier = z.string().min(1);
const optionalAmount = z.number().nonnegative().optional();

export const AppleAdsOrganizationSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  currency: z.string().length(3).optional(),
  timeZone: z.string().min(1).optional()
});

export const AppleAdsPromotedAppSchema = z.object({
  id: identifier,
  adamId: identifier,
  name: z.string().min(1)
});

export const AppleAdsCampaignSchema = z.object({
  id: identifier,
  organizationId: identifier,
  name: z.string().min(1),
  status: z.string().min(1),
  budgetAmount: optionalAmount,
  currency: z.string().length(3).optional()
});

export const AppleAdsAdGroupSchema = z.object({
  id: identifier,
  campaignId: identifier,
  name: z.string().min(1),
  status: z.string().min(1),
  defaultBidAmount: optionalAmount
});

export const AppleAdsKeywordSchema = z.object({
  id: identifier,
  adGroupId: identifier,
  text: z.string().min(1),
  matchType: z.string().min(1),
  status: z.string().min(1),
  bidAmount: optionalAmount
});

export const AppleAdsCreativeSchema = z.object({
  id: identifier,
  organizationId: identifier,
  name: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1).optional()
});

export const AppleAdsReportRowSchema = z.object({
  dimensions: z.record(z.string(), z.string()),
  metrics: z.record(z.string(), z.number().nullable())
});

export const AppleAdsKeywordSuggestionSchema = z.object({
  text: z.string().min(1),
  matchType: z.string().min(1),
  bidMin: z.number().nonnegative().optional(),
  bidMax: z.number().nonnegative().optional()
});

export type AppleAdsOrganization = z.infer<typeof AppleAdsOrganizationSchema>;
export type AppleAdsPromotedApp = z.infer<typeof AppleAdsPromotedAppSchema>;
export type AppleAdsCampaign = z.infer<typeof AppleAdsCampaignSchema>;
export type AppleAdsAdGroup = z.infer<typeof AppleAdsAdGroupSchema>;
export type AppleAdsKeyword = z.infer<typeof AppleAdsKeywordSchema>;
export type AppleAdsCreative = z.infer<typeof AppleAdsCreativeSchema>;
export type AppleAdsReportRow = z.infer<typeof AppleAdsReportRowSchema>;
export type AppleAdsKeywordSuggestion = z.infer<typeof AppleAdsKeywordSuggestionSchema>;
