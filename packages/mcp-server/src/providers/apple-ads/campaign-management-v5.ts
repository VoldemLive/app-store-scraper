import type { AppleAdsHttpClient, RequestOptions } from './http-client.js';
import type {
  AppleAdsProvider,
  AppleAdsCapabilities,
  AppleAdsOrganizationInput,
  AppleAdsCampaignInput,
  AppleAdsAdGroupInput,
  AppleAdsReportInput
} from './types.js';
import type { ProviderCallContext } from '../types.js';
import { ErrorCode, ProviderError } from '../../errors/index.js';
import type {
  AppleAdsOrganization,
  AppleAdsPromotedApp,
  AppleAdsCampaign,
  AppleAdsAdGroup,
  AppleAdsKeyword,
  AppleAdsCreative,
  AppleAdsReportRow
} from '../../schemas/index.js';

const ALL_CAPABILITIES: AppleAdsCapabilities = {
  organizations: true,
  promotedApps: true,
  campaigns: true,
  adGroups: true,
  keywords: true,
  creatives: true,
  reports: true
};

const REPORT_PATH: Record<string, string> = {
  campaign: '/reports/campaigns',
  adgroup: '/reports/adgroups',
  keyword: '/reports/keywords',
  searchterm: '/reports/searchterms',
  ad: '/reports/ads'
};

// Apple Ads Campaign Management API v5 response shapes

type AclRow = { orgId: number; orgName: string; currency?: string; timeZone?: string };
type AclResponse = { data: AclRow[] };

type AppRow = { adamId: number | string; appName: string };
type AppResponse = { data: AppRow[] };

type Money = { amount: string };
type CampaignRow = {
  id: number;
  orgId: number;
  name: string;
  status: string;
  budgetAmount?: Money;
  currency?: string;
};
type CampaignResponse = { data: CampaignRow[] };

type AdGroupRow = {
  id: number;
  campaignId: number;
  name: string;
  status: string;
  defaultBidAmount?: Money;
};
type AdGroupResponse = { data: AdGroupRow[] };

type KeywordRow = {
  id: number;
  adGroupId: number;
  text: string;
  matchType: string;
  status: string;
  bidAmount?: Money;
};
type KeywordResponse = { data: KeywordRow[] };

type CreativeRow = {
  creativeSetId?: number;
  id?: number;
  orgId: number;
  name: string;
  type?: string;
  status?: string;
};
type CreativeResponse = { data: CreativeRow[] };

type ReportMetric = Record<string, number | string | null | Money>;
type ReportRow = {
  metadata?: Record<string, number | string>;
  granularity?: ReportMetric[];
  total?: ReportMetric;
};
type ReportResponse = {
  data?: {
    reportingDataResponse?: {
      row?: ReportRow[];
    };
  };
};

function amountOf (money?: Money): number | undefined {
  if (money === undefined) return undefined;
  const n = parseFloat(money.amount);
  return isNaN(n) ? undefined : n;
}

function str (value: number | string | undefined | null): string {
  return value !== null && value !== undefined ? String(value) : '';
}

function normalizeMetricValue (value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'amount' in (value as object)) {
    const n = parseFloat(String((value as Money).amount));
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function callOpts (orgId: string, context?: ProviderCallContext): RequestOptions {
  return context?.signal !== undefined ? { orgId, signal: context.signal } : { orgId };
}

function noOrgOpts (context?: ProviderCallContext): RequestOptions {
  return context?.signal !== undefined ? { signal: context.signal } : {};
}

export class CampaignManagementV5Provider implements AppleAdsProvider {
  private readonly client: AppleAdsHttpClient;

  constructor (client: AppleAdsHttpClient) {
    this.client = client;
  }

  capabilities (): AppleAdsCapabilities {
    return { ...ALL_CAPABILITIES };
  }

  async listOrganizations (context?: ProviderCallContext): Promise<AppleAdsOrganization[]> {
    const res = await this.client.get<AclResponse>('/acls', noOrgOpts(context));
    return res.data.map(row => ({
      id: str(row.orgId),
      name: row.orgName,
      ...(row.currency !== undefined && { currency: row.currency }),
      ...(row.timeZone !== undefined && { timeZone: row.timeZone })
    }));
  }

  async listPromotedApps (
    input: AppleAdsOrganizationInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsPromotedApp[]> {
    const res = await this.client.get<AppResponse>('/apps', callOpts(input.organizationId, context));
    return res.data.map(row => ({
      id: str(row.adamId),
      adamId: str(row.adamId),
      name: row.appName
    }));
  }

  async listCampaigns (
    input: AppleAdsOrganizationInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsCampaign[]> {
    const res = await this.client.get<CampaignResponse>('/campaigns', callOpts(input.organizationId, context));
    return res.data.map(row => ({
      id: str(row.id),
      organizationId: str(row.orgId),
      name: row.name,
      status: row.status,
      ...(row.budgetAmount !== undefined && { budgetAmount: amountOf(row.budgetAmount) }),
      ...(row.currency !== undefined && { currency: row.currency })
    }));
  }

  async listAdGroups (
    input: AppleAdsCampaignInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsAdGroup[]> {
    const res = await this.client.get<AdGroupResponse>(
      `/campaigns/${input.campaignId}/adgroups`,
      callOpts(input.organizationId, context)
    );
    return res.data.map(row => ({
      id: str(row.id),
      campaignId: str(row.campaignId),
      name: row.name,
      status: row.status,
      ...(row.defaultBidAmount !== undefined && { defaultBidAmount: amountOf(row.defaultBidAmount) })
    }));
  }

  async listKeywords (
    input: AppleAdsAdGroupInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsKeyword[]> {
    const res = await this.client.get<KeywordResponse>(
      `/adgroups/${input.adGroupId}/targetingkeywords`,
      callOpts(input.organizationId, context)
    );
    return res.data.map(row => ({
      id: str(row.id),
      adGroupId: str(row.adGroupId),
      text: row.text,
      matchType: row.matchType,
      status: row.status,
      ...(row.bidAmount !== undefined && { bidAmount: amountOf(row.bidAmount) })
    }));
  }

  async listCreatives (
    input: AppleAdsOrganizationInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsCreative[]> {
    const res = await this.client.get<CreativeResponse>('/creativesets', callOpts(input.organizationId, context));
    return res.data.map(row => ({
      id: str(row.creativeSetId ?? row.id ?? 0),
      organizationId: str(row.orgId),
      name: row.name,
      type: row.type ?? 'UNKNOWN',
      ...(row.status !== undefined && { status: row.status })
    }));
  }

  async getReport (
    input: AppleAdsReportInput,
    context?: ProviderCallContext
  ): Promise<AppleAdsReportRow[]> {
    const path = REPORT_PATH[input.reportType];
    if (path === undefined) {
      throw new ProviderError(
        ErrorCode.INVALID_ARGUMENT,
        `Unsupported report type: ${input.reportType}. Valid types: ${Object.keys(REPORT_PATH).join(', ')}`,
        false
      );
    }

    const body = {
      startTime: input.startDate,
      endTime: input.endDate,
      returnRowTotals: true,
      returnGrandTotals: false,
      granularity: 'DAILY',
      timeZone: 'UTC',
      selector: {
        orderBy: [],
        conditions: [],
        pagination: { offset: 0, limit: 100 }
      }
    };

    const res = await this.client.post<ReportResponse>(path, body, callOpts(input.organizationId, context));

    const rows = res.data?.reportingDataResponse?.row ?? [];
    const result: AppleAdsReportRow[] = [];

    for (const row of rows) {
      const dimensions: Record<string, string> = {};
      const metrics: Record<string, number | null> = {};

      if (row.metadata !== undefined) {
        for (const [k, v] of Object.entries(row.metadata)) {
          dimensions[k] = str(v);
        }
      }

      const dataRows = row.granularity ?? (row.total !== undefined ? [row.total] : []);
      for (const dataRow of dataRows) {
        for (const [k, v] of Object.entries(dataRow)) {
          if (k === 'date') {
            dimensions[k] = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
          } else {
            metrics[k] = normalizeMetricValue(v);
          }
        }
        result.push({ dimensions: { ...dimensions }, metrics: { ...metrics } });
      }
    }

    return result;
  }
}
