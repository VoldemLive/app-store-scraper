import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AppleAdsOrganizationSchema,
  AppleAdsPromotedAppSchema,
  AppleAdsCampaignSchema,
  AppleAdsAdGroupSchema,
  AppleAdsKeywordSchema,
  AppleAdsCreativeSchema,
  AppleAdsReportRowSchema
} from '../../src/schemas/index.js';

test('accepts normalized Apple Ads domain values', () => {
  assert.equal(AppleAdsOrganizationSchema.parse({ id: '1', name: 'Org', currency: 'USD' }).id, '1');
  assert.equal(AppleAdsPromotedAppSchema.parse({ id: '2', adamId: '123', name: 'App' }).adamId, '123');
  assert.equal(AppleAdsCampaignSchema.parse({
    id: '3', organizationId: '1', name: 'Campaign', status: 'ENABLED', budgetAmount: 100
  }).budgetAmount, 100);
  assert.equal(AppleAdsAdGroupSchema.parse({
    id: '4', campaignId: '3', name: 'Group', status: 'ENABLED'
  }).campaignId, '3');
  assert.equal(AppleAdsKeywordSchema.parse({
    id: '5', adGroupId: '4', text: 'calendar', matchType: 'EXACT', status: 'ACTIVE'
  }).text, 'calendar');
  assert.equal(AppleAdsCreativeSchema.parse({
    id: '6', organizationId: '1', name: 'Creative', type: 'CUSTOM'
  }).type, 'CUSTOM');
  assert.deepEqual(AppleAdsReportRowSchema.parse({
    dimensions: { campaignId: '3' },
    metrics: { impressions: 10, spend: null }
  }).metrics, { impressions: 10, spend: null });
});

test('rejects values that violate normalized Apple Ads schemas', () => {
  assert.throws(() => AppleAdsOrganizationSchema.parse({ id: '', name: 'Org' }));
  assert.throws(() => AppleAdsCampaignSchema.parse({
    id: '3', organizationId: '1', name: 'Campaign', status: 'ENABLED', budgetAmount: -1
  }));
  assert.throws(() => AppleAdsReportRowSchema.parse({
    dimensions: { campaignId: 3 },
    metrics: { impressions: '10' }
  }));
});
