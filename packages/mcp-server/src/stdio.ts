import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { loadConfig } from './config.js';
import { createMcpServer } from './server.js';

export type StdioServerRuntime = {
  close: () => Promise<void>;
};

export type StartStdioServerOptions = {
  env?: NodeJS.ProcessEnv;
  transport?: Transport;
};

export async function startStdioServer (
  options: StartStdioServerOptions = {}
): Promise<StdioServerRuntime> {
  const config = loadConfig(options.env);
  const server = createMcpServer(config);
  const transport = options.transport ?? new StdioServerTransport();

  await server.connect(transport);

  return {
    close: () => server.close()
  };
}
