import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreProvider } from '../../providers/app-store/types.js';
import type { AppleAdsProvider } from '../../providers/apple-ads/types.js';
import type { ToolExecutor } from '../../application/index.js';
import { registerDiscoveryTools, registerDetailsTools } from './app-store/index.js';
import { registerAppleAdsTools } from './apple-ads/index.js';

export type ToolProviders = {
  appStore?: AppStoreProvider;
  appleAds?: AppleAdsProvider;
};

export function registerTools (
  server: McpServer,
  providers: ToolProviders,
  executeTool: ToolExecutor
): void {
  if (providers.appStore !== undefined) {
    registerDiscoveryTools(server, providers.appStore, executeTool);
    registerDetailsTools(server, providers.appStore, executeTool);
  }
  if (providers.appleAds !== undefined) {
    const caps = providers.appleAds.capabilities();
    if (caps.organizations || caps.campaigns || caps.adGroups || caps.keywords || caps.creatives || caps.promotedApps || caps.keywordSuggestions) {
      registerAppleAdsTools(server, providers.appleAds, executeTool);
    }
  }
}
