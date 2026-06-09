import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { loadConfig } from './config.js';
import { createMcpServer } from './server.js';
import { AppStoreScraperAdapter } from './providers/app-store/adapter.js';
import type { ToolProviders } from './registry/index.js';

export type StdioServerRuntime = {
  close: () => Promise<void>;
};

export type StartStdioServerOptions = {
  env?: NodeJS.ProcessEnv;
  transport?: Transport;
  providers?: ToolProviders;
};

export async function startStdioServer (
  options: StartStdioServerOptions = {}
): Promise<StdioServerRuntime> {
  const config = loadConfig(options.env);

  const appStore = options.providers?.appStore ?? await AppStoreScraperAdapter.create(config);
  const providers: ToolProviders = { appStore, ...options.providers };

  const server = createMcpServer(config, providers);
  const transport = options.transport ?? new StdioServerTransport();

  await server.connect(transport);

  return {
    close: () => server.close()
  };
}
