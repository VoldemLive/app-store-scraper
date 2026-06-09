import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type ToolProviders } from './tools/index.js';

export type { ToolProviders };

export function registerAll (server: McpServer, providers: ToolProviders): void {
  registerTools(server, providers);
}
