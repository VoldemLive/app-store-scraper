import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreProvider } from '../../providers/app-store/types.js';
import type { ToolExecutor } from '../../application/index.js';
import { registerDiscoveryTools, registerDetailsTools } from './app-store/index.js';

export type ToolProviders = {
  appStore?: AppStoreProvider;
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
}
