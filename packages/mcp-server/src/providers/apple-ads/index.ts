import { isAppleAdsConfigured, loadAppleAdsCredentials } from './credentials.js';
import { AppleAdsOAuthClient } from './oauth.js';
import { AppleAdsHttpClient } from './http-client.js';
import { CampaignManagementV5Provider } from './campaign-management-v5.js';
import { UnsupportedAppleAdsProvider } from './unsupported.js';
import type { AppleAdsProvider } from './types.js';

export { UnsupportedAppleAdsProvider } from './unsupported.js';
export { CampaignManagementV5Provider } from './campaign-management-v5.js';
export { AppleAdsOAuthClient, generateClientSecretJwt } from './oauth.js';
export { AppleAdsHttpClient, APPLE_ADS_BASE_URL } from './http-client.js';
export { loadAppleAdsCredentials, isAppleAdsConfigured } from './credentials.js';
export type { AppleAdsCredentials } from './credentials.js';
export type {
  AppleAdsProvider,
  AppleAdsCapabilities,
  AppleAdsOrganizationInput,
  AppleAdsCampaignInput,
  AppleAdsAdGroupInput,
  AppleAdsReportInput,
  AppleAdsKeywordSuggestionsInput
} from './types.js';

export function createAppleAdsProvider (env: NodeJS.ProcessEnv = process.env): AppleAdsProvider {
  if (!isAppleAdsConfigured(env)) {
    return new UnsupportedAppleAdsProvider();
  }
  const credentials = loadAppleAdsCredentials(env);
  const oauthClient = new AppleAdsOAuthClient(credentials);
  const httpClient = new AppleAdsHttpClient(oauthClient);
  return new CampaignManagementV5Provider(httpClient);
}
