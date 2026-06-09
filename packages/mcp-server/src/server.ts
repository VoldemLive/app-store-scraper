import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from './config.js';

export function createMcpServer (config: ServerConfig): McpServer {
  return new McpServer({
    name: config.name,
    version: config.version
  });
}
