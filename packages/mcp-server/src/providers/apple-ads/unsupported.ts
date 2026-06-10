import { ErrorCode, ProviderError } from '../../errors/index.js';
import type { AppleAdsCapabilities, AppleAdsProvider } from './types.js';

const NO_CAPABILITIES: AppleAdsCapabilities = {
  organizations: false,
  promotedApps: false,
  campaigns: false,
  adGroups: false,
  keywords: false,
  creatives: false,
  reports: false,
  keywordSuggestions: false
};

function unsupported (): Promise<never> {
  return Promise.reject(new ProviderError(
    ErrorCode.UNSUPPORTED_OPERATION,
    'Apple Ads provider is not configured',
    false
  ));
}

export class UnsupportedAppleAdsProvider implements AppleAdsProvider {
  capabilities (): AppleAdsCapabilities {
    return { ...NO_CAPABILITIES };
  }

  listOrganizations: AppleAdsProvider['listOrganizations'] = unsupported;
  listPromotedApps: AppleAdsProvider['listPromotedApps'] = unsupported;
  listCampaigns: AppleAdsProvider['listCampaigns'] = unsupported;
  listAdGroups: AppleAdsProvider['listAdGroups'] = unsupported;
  listKeywords: AppleAdsProvider['listKeywords'] = unsupported;
  listCreatives: AppleAdsProvider['listCreatives'] = unsupported;
  getReport: AppleAdsProvider['getReport'] = unsupported;
  getKeywordSuggestions: AppleAdsProvider['getKeywordSuggestions'] = unsupported;
}
