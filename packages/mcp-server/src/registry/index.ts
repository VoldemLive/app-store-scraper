import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type ToolProviders } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';
import type { ToolExecutor } from '../application/index.js';

export type { ToolProviders };

export function registerAll (
  server: McpServer,
  providers: ToolProviders,
  executeTool: ToolExecutor
): void {
  registerTools(server, providers, executeTool);
  registerResources(server);
  registerPrompts(server, providers);
}
