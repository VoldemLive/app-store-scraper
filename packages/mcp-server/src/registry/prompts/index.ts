import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolProviders } from '../tools/index.js';
import { registerAppStoreAnalysisPrompts } from './app-store/analysis.js';

export function registerPrompts (server: McpServer, providers: ToolProviders): void {
  if (providers.appStore !== undefined) {
    registerAppStoreAnalysisPrompts(server);
  }
}
