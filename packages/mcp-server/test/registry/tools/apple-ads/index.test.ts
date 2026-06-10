import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../../../src/server.js';
import { loadConfig } from '../../../../src/config.js';
import type { AppleAdsProvider } from '../../../../src/providers/apple-ads/types.js';
import { ErrorCode, ProviderError } from '../../../../src/errors/index.js';
import type {
  AppleAdsOrganization,
  AppleAdsCampaign,
  AppleAdsAdGroup,
  AppleAdsKeyword,
  AppleAdsKeywordSuggestion,
  AppleAdsCreative,
  AppleAdsPromotedApp
} from '../../../../src/schemas/index.js';

const config = loadConfig({});

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
};

function asResult (r: unknown): ToolResult {
  return r as ToolResult;
}

function unsupported (): Promise<never> {
  return Promise.reject(new ProviderError(ErrorCode.UNSUPPORTED_OPERATION, 'not implemented', false));
}

function makeProvider (overrides: Partial<AppleAdsProvider> = {}): AppleAdsProvider {
  return {
    capabilities: () => ({
      organizations: true,
      promotedApps: true,
      campaigns: true,
      adGroups: true,
      keywords: true,
      creatives: true,
      reports: true,
      keywordSuggestions: true
    }),
    listOrganizations: unsupported,
    listPromotedApps: unsupported,
    listCampaigns: unsupported,
    listAdGroups: unsupported,
    listKeywords: unsupported,
    listCreatives: unsupported,
    getReport: unsupported,
    getKeywordSuggestions: unsupported,
    ...overrides
  };
}

async function startTestServer (provider: AppleAdsProvider) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(config, { appleAds: provider });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0' });
  await client.connect(clientTransport);
  return { client, server };
}

const org: AppleAdsOrganization = { id: '100', name: 'Acme Corp', currency: 'USD', timeZone: 'America/New_York' };
const promotedApp: AppleAdsPromotedApp = { id: '555', adamId: '555', name: 'My App' };
const campaign: AppleAdsCampaign = { id: '200', organizationId: '100', name: 'Summer 2026', status: 'ENABLED', budgetAmount: 5000, currency: 'USD' };
const adGroup: AppleAdsAdGroup = { id: '300', campaignId: '200', name: 'Group A', status: 'ENABLED', defaultBidAmount: 1.5 };
const keyword: AppleAdsKeyword = { id: '400', adGroupId: '300', text: 'fitness app', matchType: 'BROAD', status: 'ACTIVE', bidAmount: 1.2 };
const creative: AppleAdsCreative = { id: '500', organizationId: '100', name: 'Banner Set 1', type: 'CREATIVE_SET', status: 'VALID' };

// --- tool discovery ---

test('registers all 7 Apple Ads tools', async () => {
  const { client } = await startTestServer(makeProvider());
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name);
  for (const name of [
    'apple_ads_list_organizations',
    'apple_ads_list_promoted_apps',
    'apple_ads_list_campaigns',
    'apple_ads_list_ad_groups',
    'apple_ads_list_keywords',
    'apple_ads_list_creatives',
    'apple_ads_get_keyword_suggestions'
  ]) {
    assert.ok(names.includes(name), `Missing tool: ${name}`);
  }
});

test('all Apple Ads tools carry readOnlyHint and openWorldHint', async () => {
  const { client } = await startTestServer(makeProvider());
  const { tools } = await client.listTools();
  for (const tool of tools.filter(t => t.name.startsWith('apple_ads_'))) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} missing readOnlyHint`);
    assert.equal(tool.annotations?.openWorldHint, true, `${tool.name} missing openWorldHint`);
  }
});

test('structured content meta carries provider apple-ads', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.resolve([org])
  }));
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.equal(result.isError, undefined);
  const sc = result.structuredContent as { meta: { provider: string } };
  assert.equal(sc.meta.provider, 'apple-ads');
});

// --- apple_ads_list_organizations ---

test('apple_ads_list_organizations: returns organization list', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.resolve([org])
  }));
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 organization'));
  const sc = result.structuredContent as { data: AppleAdsOrganization[]; meta: { resultCount: number } };
  assert.equal(sc.meta.resultCount, 1);
  assert.equal(sc.data[0]?.id, '100');
  assert.equal(sc.data[0]?.name, 'Acme Corp');
});

test('apple_ads_list_organizations: returns plural label for multiple', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.resolve([org, { ...org, id: '101', name: 'Beta Inc' }])
  }));
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.ok((result.content[0]?.text ?? '').includes('2 organizations'));
});

test('apple_ads_list_organizations: normalizes UNSUPPORTED_OPERATION to error', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('UNSUPPORTED_OPERATION'));
});

test('apple_ads_list_organizations: normalizes AUTH_REQUIRED to error', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.reject(new ProviderError(ErrorCode.AUTH_REQUIRED, 'token expired', false))
  }));
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('AUTH_REQUIRED'));
});

test('apple_ads_list_organizations: normalizes UPSTREAM_RATE_LIMITED to error', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.reject(new ProviderError(ErrorCode.UPSTREAM_RATE_LIMITED, 'rate limited', true))
  }));
  const result = asResult(await client.callTool({ name: 'apple_ads_list_organizations', arguments: {} }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('UPSTREAM_RATE_LIMITED'));
});

// --- apple_ads_list_promoted_apps ---

test('apple_ads_list_promoted_apps: returns promoted apps', async () => {
  const { client } = await startTestServer(makeProvider({
    listPromotedApps: () => Promise.resolve([promotedApp])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_promoted_apps',
    arguments: { organizationId: '100' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 promoted app'));
  assert.ok((result.content[0]?.text ?? '').includes('100'));
  const sc = result.structuredContent as { data: AppleAdsPromotedApp[] };
  assert.equal(sc.data[0]?.adamId, '555');
});

test('apple_ads_list_promoted_apps: passes organizationId to provider', async () => {
  let receivedOrgId: string | undefined;
  const { client } = await startTestServer(makeProvider({
    listPromotedApps: input => {
      receivedOrgId = input.organizationId;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_list_promoted_apps', arguments: { organizationId: '42' } });
  assert.equal(receivedOrgId, '42');
});

test('apple_ads_list_promoted_apps: requires organizationId', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_promoted_apps',
    arguments: {}
  }));
  assert.equal(result.isError, true);
});

// --- apple_ads_list_campaigns ---

test('apple_ads_list_campaigns: returns campaign list', async () => {
  const { client } = await startTestServer(makeProvider({
    listCampaigns: () => Promise.resolve([campaign])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_campaigns',
    arguments: { organizationId: '100' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 campaign'));
  const sc = result.structuredContent as { data: AppleAdsCampaign[] };
  assert.equal(sc.data[0]?.name, 'Summer 2026');
  assert.equal(sc.data[0]?.status, 'ENABLED');
});

test('apple_ads_list_campaigns: passes organizationId to provider', async () => {
  let receivedOrgId: string | undefined;
  const { client } = await startTestServer(makeProvider({
    listCampaigns: input => {
      receivedOrgId = input.organizationId;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_list_campaigns', arguments: { organizationId: '99' } });
  assert.equal(receivedOrgId, '99');
});

test('apple_ads_list_campaigns: normalizes PERMISSION_DENIED to error', async () => {
  const { client } = await startTestServer(makeProvider({
    listCampaigns: () => Promise.reject(new ProviderError(ErrorCode.PERMISSION_DENIED, 'forbidden', false))
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_campaigns',
    arguments: { organizationId: '100' }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('PERMISSION_DENIED'));
});

// --- apple_ads_list_ad_groups ---

test('apple_ads_list_ad_groups: returns ad group list', async () => {
  const { client } = await startTestServer(makeProvider({
    listAdGroups: () => Promise.resolve([adGroup])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_ad_groups',
    arguments: { organizationId: '100', campaignId: '200' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 ad group'));
  assert.ok((result.content[0]?.text ?? '').includes('200'));
  const sc = result.structuredContent as { data: AppleAdsAdGroup[] };
  assert.equal(sc.data[0]?.name, 'Group A');
});

test('apple_ads_list_ad_groups: passes both ids to provider', async () => {
  let received: { organizationId: string; campaignId: string } | undefined;
  const { client } = await startTestServer(makeProvider({
    listAdGroups: input => {
      received = { organizationId: input.organizationId, campaignId: input.campaignId };
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_list_ad_groups', arguments: { organizationId: '1', campaignId: '2' } });
  assert.deepEqual(received, { organizationId: '1', campaignId: '2' });
});

test('apple_ads_list_ad_groups: requires campaignId', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_ad_groups',
    arguments: { organizationId: '100' }
  }));
  assert.equal(result.isError, true);
});

// --- apple_ads_list_keywords ---

test('apple_ads_list_keywords: returns keyword list', async () => {
  const { client } = await startTestServer(makeProvider({
    listKeywords: () => Promise.resolve([keyword])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_keywords',
    arguments: { organizationId: '100', campaignId: '200', adGroupId: '300' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 keyword'));
  assert.ok((result.content[0]?.text ?? '').includes('300'));
  const sc = result.structuredContent as { data: AppleAdsKeyword[] };
  assert.equal(sc.data[0]?.text, 'fitness app');
  assert.equal(sc.data[0]?.matchType, 'BROAD');
});

test('apple_ads_list_keywords: passes all three ids to provider', async () => {
  let received: { organizationId: string; campaignId: string; adGroupId: string } | undefined;
  const { client } = await startTestServer(makeProvider({
    listKeywords: input => {
      received = { organizationId: input.organizationId, campaignId: input.campaignId, adGroupId: input.adGroupId };
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_list_keywords', arguments: { organizationId: '1', campaignId: '2', adGroupId: '3' } });
  assert.deepEqual(received, { organizationId: '1', campaignId: '2', adGroupId: '3' });
});

test('apple_ads_list_keywords: requires adGroupId', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_keywords',
    arguments: { organizationId: '100', campaignId: '200' }
  }));
  assert.equal(result.isError, true);
});

// --- apple_ads_list_creatives ---

test('apple_ads_list_creatives: returns creative list', async () => {
  const { client } = await startTestServer(makeProvider({
    listCreatives: () => Promise.resolve([creative])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_creatives',
    arguments: { organizationId: '100' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('1 creative'));
  const sc = result.structuredContent as { data: AppleAdsCreative[] };
  assert.equal(sc.data[0]?.name, 'Banner Set 1');
  assert.equal(sc.data[0]?.type, 'CREATIVE_SET');
});

test('apple_ads_list_creatives: passes organizationId to provider', async () => {
  let receivedOrgId: string | undefined;
  const { client } = await startTestServer(makeProvider({
    listCreatives: input => {
      receivedOrgId = input.organizationId;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_list_creatives', arguments: { organizationId: '77' } });
  assert.equal(receivedOrgId, '77');
});

// --- response controls ---

test('maxItems limits result count', async () => {
  const orgs = Array.from({ length: 10 }, (_, i) => ({ ...org, id: String(i) }));
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.resolve(orgs)
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_organizations',
    arguments: { maxItems: 3 }
  }));
  assert.equal(result.isError, undefined);
  const sc = result.structuredContent as { data: AppleAdsOrganization[]; meta: { resultCount: number; totalCount: number; truncated: boolean } };
  assert.equal(sc.data.length, 3);
  assert.equal(sc.meta.totalCount, 10);
  assert.equal(sc.meta.truncated, true);
});

test('fields filter selects specific properties', async () => {
  const { client } = await startTestServer(makeProvider({
    listOrganizations: () => Promise.resolve([org])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_list_organizations',
    arguments: { fields: ['id', 'name'] }
  }));
  assert.equal(result.isError, undefined);
  const sc = result.structuredContent as { data: Array<Record<string, unknown>> };
  assert.ok('id' in sc.data[0]!);
  assert.ok('name' in sc.data[0]!);
  assert.ok(!('currency' in sc.data[0]!));
});

// --- apple_ads_get_keyword_suggestions ---

const suggestion: AppleAdsKeywordSuggestion = { text: 'fitness tracker', matchType: 'BROAD', bidMin: 0.5, bidMax: 2.0 };
const suggestionExact: AppleAdsKeywordSuggestion = { text: 'fitness app', matchType: 'EXACT', bidMin: 1.0, bidMax: 3.5 };

test('apple_ads_get_keyword_suggestions: returns suggestions with bid ranges', async () => {
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: () => Promise.resolve([suggestion, suggestionExact])
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '284882218' }
  }));
  assert.equal(result.isError, undefined);
  assert.ok((result.content[0]?.text ?? '').includes('2 keyword suggestions'));
  assert.ok((result.content[0]?.text ?? '').includes('284882218'));
  const sc = result.structuredContent as { data: AppleAdsKeywordSuggestion[]; meta: { provider: string } };
  assert.equal(sc.meta.provider, 'apple-ads');
  assert.equal(sc.data[0]?.text, 'fitness tracker');
  assert.equal(sc.data[0]?.matchType, 'BROAD');
  assert.equal(sc.data[0]?.bidMin, 0.5);
  assert.equal(sc.data[0]?.bidMax, 2.0);
});

test('apple_ads_get_keyword_suggestions: passes appAdamId to provider', async () => {
  let receivedAdamId: string | undefined;
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: input => {
      receivedAdamId = input.appAdamId;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({ name: 'apple_ads_get_keyword_suggestions', arguments: { appAdamId: '123456789' } });
  assert.equal(receivedAdamId, '123456789');
});

test('apple_ads_get_keyword_suggestions: passes matchTypes filter to provider', async () => {
  let receivedMatchTypes: string[] | undefined;
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: input => {
      receivedMatchTypes = input.matchTypes;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '111', matchTypes: ['EXACT'] }
  });
  assert.deepEqual(receivedMatchTypes, ['EXACT']);
});

test('apple_ads_get_keyword_suggestions: passes pagination to provider', async () => {
  let receivedOffset: number | undefined;
  let receivedLimit: number | undefined;
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: input => {
      receivedOffset = input.offset;
      receivedLimit = input.limit;
      return Promise.resolve([]);
    }
  }));
  await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '111', offset: 20, limit: 50 }
  });
  assert.equal(receivedOffset, 20);
  assert.equal(receivedLimit, 50);
});

test('apple_ads_get_keyword_suggestions: requires appAdamId', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: {}
  }));
  assert.equal(result.isError, true);
});

test('apple_ads_get_keyword_suggestions: rejects limit above 100', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '111', limit: 200 }
  }));
  assert.equal(result.isError, true);
});

test('apple_ads_get_keyword_suggestions: works with competitor app Adam ID', async () => {
  const competitorAdamId = '389801252';
  let receivedAdamId: string | undefined;
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: input => {
      receivedAdamId = input.appAdamId;
      return Promise.resolve([suggestion]);
    }
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: competitorAdamId }
  }));
  assert.equal(result.isError, undefined);
  assert.equal(receivedAdamId, competitorAdamId);
});

test('apple_ads_get_keyword_suggestions: normalizes AUTH_REQUIRED to error', async () => {
  const { client } = await startTestServer(makeProvider({
    getKeywordSuggestions: () => Promise.reject(new ProviderError(ErrorCode.AUTH_REQUIRED, 'token expired', false))
  }));
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '111' }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('AUTH_REQUIRED'));
});

test('apple_ads_get_keyword_suggestions: normalizes UNSUPPORTED_OPERATION when not configured', async () => {
  const { client } = await startTestServer(makeProvider());
  const result = asResult(await client.callTool({
    name: 'apple_ads_get_keyword_suggestions',
    arguments: { appAdamId: '111' }
  }));
  assert.equal(result.isError, true);
  assert.ok((result.content[0]?.text ?? '').includes('UNSUPPORTED_OPERATION'));
});
