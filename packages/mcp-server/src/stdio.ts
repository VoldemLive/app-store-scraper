import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createMcpServer } from './server.js';
import { createStderrLogger, type Logger } from './application/index.js';
import { startupConnectionLog, type McpClientConfig } from './application/connections.js';
import { AppStoreScraperAdapter } from './providers/app-store/adapter.js';
import type { ToolProviders } from './registry/index.js';

export type StdioServerRuntime = {
  close: () => Promise<void>;
};

export type StartStdioServerOptions = {
  env?: NodeJS.ProcessEnv;
  transport?: Transport;
  providers?: ToolProviders;
  logger?: Logger;
};

function stdioClientConfig (config: ReturnType<typeof loadConfig>): McpClientConfig {
  return {
    mcpServers: {
      app_store: {
        command: process.execPath,
        args: [resolve(process.argv[1] ?? 'dist/src/cli.js')],
        env: {
          MCP_LOG_LEVEL: config.logLevel,
          MCP_REQUEST_TIMEOUT_MS: String(config.request.timeoutMs)
        }
      }
    }
  };
}

export async function startStdioServer (
  options: StartStdioServerOptions = {}
): Promise<StdioServerRuntime> {
  const config = loadConfig(options.env);

  const appStore = options.providers?.appStore ?? await AppStoreScraperAdapter.create(config);
  const providers: ToolProviders = { appStore, ...options.providers };
  const logger = options.logger ?? createStderrLogger(config);

  const server = createMcpServer(config, providers, logger);
  const transport = options.transport ?? new StdioServerTransport();

  await server.connect(transport);
  const transportName = options.transport === undefined ? 'stdio' : 'custom';
  logger.log(startupConnectionLog(
    config,
    transportName,
    transportName === 'stdio' ? stdioClientConfig(config) : undefined
  ));

  return {
    close: () => server.close()
  };
}
