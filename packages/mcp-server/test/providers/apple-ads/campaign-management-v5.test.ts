import assert from 'node:assert/strict';
import test from 'node:test';
import { CampaignManagementV5Provider } from '../../../src/providers/apple-ads/index.js';
import type { AppleAdsHttpClient } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

type FakeResponses = Record<string, unknown>;

function makeClient (responses: FakeResponses): AppleAdsHttpClient {
  return {
    get: async <T>(path: string, _opts?: unknown): Promise<T> => {
      const key = path.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}');
      const pathWithoutQuery = path.split('?')[0]!;
      const normalized = responses[key] ?? responses[path] ?? responses[pathWithoutQuery];
      if (normalized === undefined) throw new Error(`Unexpected GET ${path}`);
      if (normalized instanceof Error) throw normalized;
      return normalized as T;
    },
    post: async <T>(path: string, _body?: unknown, _opts?: unknown): Promise<T> => {
      const normalized = responses[path];
      if (normalized === undefined) throw new Error(`Unexpected POST ${path}`);
      if (normalized instanceof Error) throw normalized;
      return normalized as T;
    },
    request: async <T>(_method: string, _path: string, _opts?: unknown): Promise<T> => {
      throw new Error('request() not expected in tests');
    }
  } as unknown as AppleAdsHttpClient;
}

const ORG_RESPONSE = {
  data: [
    { orgId: 111, orgName: 'Acme Corp', currency: 'USD', timeZone: 'America/New_York' }
  ]
};

const APP_RESPONSE = {
  data: [
    { adamId: 123456, appName: 'My App' }
  ]
};

const CAMPAIGN_RESPONSE = {
  data: [
    {
      id: 99,
      orgId: 111,
      name: 'Summer Campaign',
      status: 'ENABLED',
      budgetAmount: { amount: '500.00' },
      currency: 'USD'
    }
  ]
};

const ADGROUP_RESPONSE = {
  data: [
    {
      id: 77,
      campaignId: 99,
      name: 'Ad Group 1',
      status: 'ENABLED',
      defaultBidAmount: { amount: '1.50' }
    }
  ]
};

const KEYWORD_RESPONSE = {
  data: [
    {
      id: 55,
      adGroupId: 77,
      text: 'productivity app',
      matchType: 'BROAD',
      status: 'ACTIVE',
      bidAmount: { amount: '0.80' }
    }
  ]
};

const CREATIVE_RESPONSE = {
  data: [
    { creativeSetId: 33, orgId: 111, name: 'Creative Set A', type: 'CUSTOM_PRODUCT_PAGE', status: 'VALID' }
  ]
};

const REPORT_RESPONSE = {
  data: {
    reportingDataResponse: {
      row: [
        {
          metadata: { campaignId: 99, campaignName: 'Summer Campaign' },
          granularity: [
            { date: '2026-01-01', impressions: 1000, taps: 50, localSpend: { amount: '25.00' } }
          ]
        }
      ]
    }
  }
};

test('capabilities reports all operations supported', () => {
  const provider = new CampaignManagementV5Provider(makeClient({}));
  assert.deepEqual(provider.capabilities(), {
    organizations: true,
    promotedApps: true,
    campaigns: true,
    adGroups: true,
    keywords: true,
    creatives: true,
    reports: true,
    keywordSuggestions: true
  });
});

test('listOrganizations normalizes ACL response to domain type', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/acls': ORG_RESPONSE }));
  const orgs = await provider.listOrganizations();
  assert.equal(orgs.length, 1);
  assert.equal(orgs[0]!.id, '111');
  assert.equal(orgs[0]!.name, 'Acme Corp');
  assert.equal(orgs[0]!.currency, 'USD');
  assert.equal(orgs[0]!.timeZone, 'America/New_York');
});

test('listPromotedApps normalizes app response to domain type', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/apps': APP_RESPONSE }));
  const apps = await provider.listPromotedApps({ organizationId: '111' });
  assert.equal(apps.length, 1);
  assert.equal(apps[0]!.adamId, '123456');
  assert.equal(apps[0]!.name, 'My App');
});

test('listCampaigns normalizes campaign response including budget', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/campaigns': CAMPAIGN_RESPONSE }));
  const campaigns = await provider.listCampaigns({ organizationId: '111' });
  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0]!.id, '99');
  assert.equal(campaigns[0]!.organizationId, '111');
  assert.equal(campaigns[0]!.name, 'Summer Campaign');
  assert.equal(campaigns[0]!.status, 'ENABLED');
  assert.equal(campaigns[0]!.budgetAmount, 500);
  assert.equal(campaigns[0]!.currency, 'USD');
});

test('listAdGroups normalizes ad group response including bid', async () => {
  const responses = { '/campaigns/{id}/adgroups': ADGROUP_RESPONSE };
  const provider = new CampaignManagementV5Provider(makeClient(responses));
  const groups = await provider.listAdGroups({ organizationId: '111', campaignId: '99' });
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.id, '77');
  assert.equal(groups[0]!.campaignId, '99');
  assert.equal(groups[0]!.status, 'ENABLED');
  assert.equal(groups[0]!.defaultBidAmount, 1.5);
});

test('listKeywords normalizes keyword response', async () => {
  const responses = { '/adgroups/{id}/targetingkeywords': KEYWORD_RESPONSE };
  const provider = new CampaignManagementV5Provider(makeClient(responses));
  const keywords = await provider.listKeywords({ organizationId: '111', campaignId: '99', adGroupId: '77' });
  assert.equal(keywords.length, 1);
  assert.equal(keywords[0]!.id, '55');
  assert.equal(keywords[0]!.adGroupId, '77');
  assert.equal(keywords[0]!.text, 'productivity app');
  assert.equal(keywords[0]!.matchType, 'BROAD');
  assert.equal(keywords[0]!.bidAmount, 0.8);
});

test('listCreatives normalizes creative set response', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/creativesets': CREATIVE_RESPONSE }));
  const creatives = await provider.listCreatives({ organizationId: '111' });
  assert.equal(creatives.length, 1);
  assert.equal(creatives[0]!.id, '33');
  assert.equal(creatives[0]!.organizationId, '111');
  assert.equal(creatives[0]!.type, 'CUSTOM_PRODUCT_PAGE');
  assert.equal(creatives[0]!.status, 'VALID');
});

test('getReport normalizes campaign report response to report rows', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/reports/campaigns': REPORT_RESPONSE }));
  const rows = await provider.getReport({
    organizationId: '111',
    reportType: 'campaign',
    startDate: '2026-01-01',
    endDate: '2026-01-31'
  });
  assert.ok(rows.length > 0);
  const row = rows[0]!;
  assert.equal(row.dimensions['campaignId'], '99');
  assert.equal(row.dimensions['date'], '2026-01-01');
  assert.equal(row.metrics['impressions'], 1000);
  assert.equal(row.metrics['taps'], 50);
  assert.equal(row.metrics['localSpend'], 25);
});

test('getReport throws INVALID_ARGUMENT for unknown report type', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({}));
  await assert.rejects(
    () => provider.getReport({
      organizationId: '111',
      reportType: 'invalid',
      startDate: '2026-01-01',
      endDate: '2026-01-31'
    }),
    (error: unknown) => error instanceof ProviderError && error.code === ErrorCode.INVALID_ARGUMENT
  );
});

test('provider propagates ProviderError from HTTP client', async () => {
  const error = new ProviderError(ErrorCode.PERMISSION_DENIED, 'no access', false);
  const client = makeClient({ '/campaigns': error });
  const provider = new CampaignManagementV5Provider(client);
  await assert.rejects(
    () => provider.listCampaigns({ organizationId: '111' }),
    (e: unknown) => e instanceof ProviderError && e.code === ErrorCode.PERMISSION_DENIED
  );
});

const SUGGESTIONS_RESPONSE = {
  data: [
    {
      text: 'fitness tracker',
      matchType: 'BROAD',
      bidRecommendation: {
        bidMin: { amount: '0.50' },
        bidMax: { amount: '2.00' }
      }
    },
    {
      text: 'run app',
      matchType: 'EXACT',
      bidRecommendation: {
        bidMin: { amount: '1.00' },
        bidMax: { amount: '3.50' }
      }
    },
    {
      text: 'workout',
      matchType: 'BROAD'
    }
  ]
};

test('getKeywordSuggestions normalizes suggestion response to domain type', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/keywords/targeting/suggestions': SUGGESTIONS_RESPONSE }));
  const results = await provider.getKeywordSuggestions({ appAdamId: '284882218' });
  assert.equal(results.length, 3);
  assert.equal(results[0]!.text, 'fitness tracker');
  assert.equal(results[0]!.matchType, 'BROAD');
  assert.equal(results[0]!.bidMin, 0.5);
  assert.equal(results[0]!.bidMax, 2.0);
});

test('getKeywordSuggestions handles missing bidRecommendation gracefully', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/keywords/targeting/suggestions': SUGGESTIONS_RESPONSE }));
  const results = await provider.getKeywordSuggestions({ appAdamId: '284882218' });
  const workout = results.find(r => r.text === 'workout')!;
  assert.equal(workout.bidMin, undefined);
  assert.equal(workout.bidMax, undefined);
});

test('getKeywordSuggestions filters by matchTypes when provided', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/keywords/targeting/suggestions': SUGGESTIONS_RESPONSE }));
  const results = await provider.getKeywordSuggestions({ appAdamId: '284882218', matchTypes: ['EXACT'] });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.text, 'run app');
  assert.equal(results[0]!.matchType, 'EXACT');
});

test('getKeywordSuggestions matchType filter is case-insensitive', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/keywords/targeting/suggestions': SUGGESTIONS_RESPONSE }));
  const results = await provider.getKeywordSuggestions({ appAdamId: '284882218', matchTypes: ['broad'] });
  assert.equal(results.length, 2);
});

test('getKeywordSuggestions returns all results when matchTypes is empty', async () => {
  const provider = new CampaignManagementV5Provider(makeClient({ '/keywords/targeting/suggestions': SUGGESTIONS_RESPONSE }));
  const results = await provider.getKeywordSuggestions({ appAdamId: '284882218', matchTypes: [] });
  assert.equal(results.length, 3);
});
