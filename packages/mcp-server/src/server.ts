import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from './config.js';
import { registerAll, type ToolProviders } from './registry/index.js';
import { createStderrLogger, createToolExecutor, type Logger } from './application/index.js';

export type { ToolProviders };

export function createMcpServer (
  config: ServerConfig,
  providers: ToolProviders = {},
  logger: Logger = createStderrLogger(config)
): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version
  });
  registerAll(server, providers, createToolExecutor(config, logger));
  return server;
}
