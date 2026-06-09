import assert from 'node:assert/strict';
import test from 'node:test';
import { UnsupportedAppleAdsProvider } from '../../../src/providers/apple-ads/index.js';
import { ErrorCode, ProviderError } from '../../../src/errors/index.js';

test('reports no Apple Ads capabilities', () => {
  const provider = new UnsupportedAppleAdsProvider();
  assert.deepEqual(provider.capabilities(), {
    organizations: false,
    promotedApps: false,
    campaigns: false,
    adGroups: false,
    keywords: false,
    creatives: false,
    reports: false
  });
});

test('returns normalized unsupported errors for every Apple Ads operation', async () => {
  const provider = new UnsupportedAppleAdsProvider();
  const operations = [
    () => provider.listOrganizations(),
    () => provider.listPromotedApps({ organizationId: '1' }),
    () => provider.listCampaigns({ organizationId: '1' }),
    () => provider.listAdGroups({ organizationId: '1', campaignId: '2' }),
    () => provider.listKeywords({ organizationId: '1', campaignId: '2', adGroupId: '3' }),
    () => provider.listCreatives({ organizationId: '1' }),
    () => provider.getReport({
      organizationId: '1',
      reportType: 'campaign',
      startDate: '2026-01-01',
      endDate: '2026-01-02'
    })
  ];

  for (const operation of operations) {
    await assert.rejects(
      operation(),
      (error: unknown) => error instanceof ProviderError &&
        error.code === ErrorCode.UNSUPPORTED_OPERATION &&
        error.retryable === false
    );
  }
});
