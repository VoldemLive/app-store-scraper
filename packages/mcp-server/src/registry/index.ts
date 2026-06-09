import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type ToolProviders } from './tools/index.js';
import { registerResources } from './resources/index.js';

export type { ToolProviders };

export function registerAll (server: McpServer, providers: ToolProviders): void {
  registerTools(server, providers);
  registerResources(server);
}
