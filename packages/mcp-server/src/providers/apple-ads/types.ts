import type {
  AppleAdsAdGroup,
  AppleAdsCampaign,
  AppleAdsCreative,
  AppleAdsKeyword,
  AppleAdsOrganization,
  AppleAdsPromotedApp,
  AppleAdsReportRow
} from '../../schemas/index.js';

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
  listOrganizations(): Promise<AppleAdsOrganization[]>;
  listPromotedApps(input: AppleAdsOrganizationInput): Promise<AppleAdsPromotedApp[]>;
  listCampaigns(input: AppleAdsOrganizationInput): Promise<AppleAdsCampaign[]>;
  listAdGroups(input: AppleAdsCampaignInput): Promise<AppleAdsAdGroup[]>;
  listKeywords(input: AppleAdsAdGroupInput): Promise<AppleAdsKeyword[]>;
  listCreatives(input: AppleAdsOrganizationInput): Promise<AppleAdsCreative[]>;
  getReport(input: AppleAdsReportInput): Promise<AppleAdsReportRow[]>;
}
