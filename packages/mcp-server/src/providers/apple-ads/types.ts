import type {
  AppleAdsAdGroup,
  AppleAdsCampaign,
  AppleAdsCreative,
  AppleAdsKeyword,
  AppleAdsOrganization,
  AppleAdsPromotedApp,
  AppleAdsReportRow
} from '../../schemas/index.js';
import type { ProviderCallContext } from '../types.js';

export type AppleAdsCapabilities = {
  organizations: boolean;
  promotedApps: boolean;
  campaigns: boolean;
  adGroups: boolean;
  keywords: boolean;
  creatives: boolean;
  reports: boolean;
};

export type AppleAdsOrganizationInput = { organizationId: string };
export type AppleAdsCampaignInput = AppleAdsOrganizationInput & { campaignId: string };
export type AppleAdsAdGroupInput = AppleAdsCampaignInput & { adGroupId: string };
export type AppleAdsReportInput = AppleAdsOrganizationInput & {
  reportType: string;
  startDate: string;
  endDate: string;
};

export interface AppleAdsProvider {
  capabilities(): AppleAdsCapabilities;
  listOrganizations(context?: ProviderCallContext): Promise<AppleAdsOrganization[]>;
  listPromotedApps(input: AppleAdsOrganizationInput, context?: ProviderCallContext): Promise<AppleAdsPromotedApp[]>;
  listCampaigns(input: AppleAdsOrganizationInput, context?: ProviderCallContext): Promise<AppleAdsCampaign[]>;
  listAdGroups(input: AppleAdsCampaignInput, context?: ProviderCallContext): Promise<AppleAdsAdGroup[]>;
  listKeywords(input: AppleAdsAdGroupInput, context?: ProviderCallContext): Promise<AppleAdsKeyword[]>;
  listCreatives(input: AppleAdsOrganizationInput, context?: ProviderCallContext): Promise<AppleAdsCreative[]>;
  getReport(input: AppleAdsReportInput, context?: ProviderCallContext): Promise<AppleAdsReportRow[]>;
}
