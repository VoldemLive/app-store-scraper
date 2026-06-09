import { z } from 'zod';

const configSchema = z.object({
  MCP_SERVER_NAME: z.string().trim().min(1).default('app-store-scraper-mcp'),
  MCP_SERVER_VERSION: z.string().trim().min(1).default('0.1.0'),
  MCP_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type ServerConfig = {
  name: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export class ConfigError extends Error {
  constructor () {
    super('Invalid MCP server configuration');
    this.name = 'ConfigError';
  }
}

export function loadConfig (env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    throw new ConfigError();
  }

  return {
    name: parsed.data.MCP_SERVER_NAME,
    version: parsed.data.MCP_SERVER_VERSION,
    logLevel: parsed.data.MCP_LOG_LEVEL
  };
}
