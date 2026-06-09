import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from './config.js';
import { registerAll, type ToolProviders } from './registry/index.js';

export type { ToolProviders };

export function createMcpServer (config: ServerConfig, providers: ToolProviders = {}): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version
  });
  registerAll(server, providers);
  return server;
}
