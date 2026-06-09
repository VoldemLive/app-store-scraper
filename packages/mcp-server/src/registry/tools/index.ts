import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreProvider } from '../../providers/app-store/types.js';
import { registerDiscoveryTools, registerDetailsTools } from './app-store/index.js';

export type ToolProviders = {
  appStore?: AppStoreProvider;
};

export function registerTools (server: McpServer, providers: ToolProviders): void {
  if (providers.appStore !== undefined) {
    registerDiscoveryTools(server, providers.appStore);
    registerDetailsTools(server, providers.appStore);
  }
}
