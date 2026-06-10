import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppleAdsProvider } from '../../../providers/apple-ads/types.js';
import { responseControlShape, type ResponseControls, type ToolExecutor } from '../../../application/index.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const orgIdInput = z.string().min(1).describe('Apple Search Ads organization ID');
const campaignIdInput = z.string().min(1).describe('Campaign ID');
const adGroupIdInput = z.string().min(1).describe('Ad group ID');
const adamIdInput = z.string().min(1).describe('App Store app numeric ID (Adam ID) — any app including competitors');

function controls (
  responseMode?: 'compact' | 'full',
  fields?: string[],
  maxItems?: number
): ResponseControls {
  return {
    responseMode: responseMode ?? 'full',
    ...(fields !== undefined && { fields }),
    ...(maxItems !== undefined && { maxItems }),
    provider: 'apple-ads'
  };
}

function plural (count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`;
}

export function registerAppleAdsTools (
  server: McpServer,
  provider: AppleAdsProvider,
  executeTool: ToolExecutor
): void {
  server.tool(
    'apple_ads_list_organizations',
    'List all Apple Search Ads organizations accessible with the configured credentials.',
    { ...responseControlShape },
    READ_ONLY,
    async ({ responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_organizations', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listOrganizations({ signal });
        return {
          text: `Found ${plural(results.length, 'organization')}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_list_promoted_apps',
    'List apps promoted through Apple Search Ads within an organization.',
    {
      organizationId: orgIdInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ organizationId, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_promoted_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listPromotedApps({ organizationId }, { signal });
        return {
          text: `Found ${plural(results.length, 'promoted app')} for organization ${organizationId}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_list_campaigns',
    'List campaigns within an Apple Search Ads organization.',
    {
      organizationId: orgIdInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ organizationId, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_campaigns', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listCampaigns({ organizationId }, { signal });
        return {
          text: `Found ${plural(results.length, 'campaign')} for organization ${organizationId}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_list_ad_groups',
    'List ad groups within an Apple Search Ads campaign.',
    {
      organizationId: orgIdInput,
      campaignId: campaignIdInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ organizationId, campaignId, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_ad_groups', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listAdGroups({ organizationId, campaignId }, { signal });
        return {
          text: `Found ${plural(results.length, 'ad group')} for campaign ${campaignId}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_list_keywords',
    'List targeting keywords for an Apple Search Ads ad group.',
    {
      organizationId: orgIdInput,
      campaignId: campaignIdInput,
      adGroupId: adGroupIdInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ organizationId, campaignId, adGroupId, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_keywords', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listKeywords({ organizationId, campaignId, adGroupId }, { signal });
        return {
          text: `Found ${plural(results.length, 'keyword')} for ad group ${adGroupId}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_list_creatives',
    'List creative sets within an Apple Search Ads organization.',
    {
      organizationId: orgIdInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ organizationId, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_list_creatives', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listCreatives({ organizationId }, { signal });
        return {
          text: `Found ${plural(results.length, 'creative')} for organization ${organizationId}.`,
          data: results
        };
      })
  );

  server.tool(
    'apple_ads_get_keyword_suggestions',
    'Get Apple Search Ads keyword suggestions for any app by Adam ID. Returns keywords with match types and bid range signals — useful for competitive research and keyword demand analysis without requiring active campaigns.',
    {
      appAdamId: adamIdInput,
      matchTypes: z.array(z.enum(['BROAD', 'EXACT'])).max(2).optional()
        .describe('Filter by match type (default: both BROAD and EXACT)'),
      offset: z.number().int().min(0).optional()
        .describe('Pagination offset (default: 0)'),
      limit: z.number().int().min(1).max(100).optional()
        .describe('Maximum suggestions to return from Apple Ads API (default: 20, max: 100)'),
      ...responseControlShape
    },
    READ_ONLY,
    async ({ appAdamId, matchTypes, offset, limit, responseMode, fields, maxItems }, extra) =>
      executeTool('apple_ads_get_keyword_suggestions', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.getKeywordSuggestions(
          {
            appAdamId,
            ...(matchTypes !== undefined && { matchTypes }),
            ...(offset !== undefined && { offset }),
            ...(limit !== undefined && { limit })
          },
          { signal }
        );
        return {
          text: `Found ${plural(results.length, 'keyword suggestion')} for app ${appAdamId}.`,
          data: results
        };
      })
  );
}
