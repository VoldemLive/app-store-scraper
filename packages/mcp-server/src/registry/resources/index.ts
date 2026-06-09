import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReferenceResources } from './app-store/reference.js';

export function registerResources (server: McpServer): void {
  registerReferenceResources(server);
}
