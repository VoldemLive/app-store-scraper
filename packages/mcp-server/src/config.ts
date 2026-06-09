import { z } from 'zod';

const configSchema = z.object({
  MCP_SERVER_NAME: z.string().trim().min(1).default('app-store-scraper-mcp'),
  MCP_SERVER_VERSION: z.string().trim().min(1).default('0.1.0'),
  MCP_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
  MCP_REQUEST_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  MCP_REQUEST_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(60000).default(250),
  MCP_REQUEST_MAX_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(120000).default(5000),
  MCP_REQUEST_THROTTLE_RPS: z.coerce.number().int().min(1).max(100).default(10),
  MCP_CACHE_TTL_MS: z.coerce.number().int().min(0).max(86400000).default(300000),
  MCP_CACHE_MAX_ENTRIES: z.coerce.number().int().min(0).max(10000).default(1000),
  MCP_MAX_RESULT_ITEMS: z.coerce.number().int().min(1).max(200).default(50),
  MCP_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1024).max(10485760).default(1048576)
});

export type ServerConfig = {
  name: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  request: {
    timeoutMs: number;
    retries: number;
    retryDelayMs: number;
    maxRetryDelayMs: number;
    throttleRps: number;
  };
  cache: {
    ttlMs: number;
    maxEntries: number;
  };
  response: {
    maxItems: number;
    maxBytes: number;
  };
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
    logLevel: parsed.data.MCP_LOG_LEVEL,
    request: {
      timeoutMs: parsed.data.MCP_REQUEST_TIMEOUT_MS,
      retries: parsed.data.MCP_REQUEST_RETRIES,
      retryDelayMs: parsed.data.MCP_REQUEST_RETRY_DELAY_MS,
      maxRetryDelayMs: parsed.data.MCP_REQUEST_MAX_RETRY_DELAY_MS,
      throttleRps: parsed.data.MCP_REQUEST_THROTTLE_RPS
    },
    cache: {
      ttlMs: parsed.data.MCP_CACHE_TTL_MS,
      maxEntries: parsed.data.MCP_CACHE_MAX_ENTRIES
    },
    response: {
      maxItems: parsed.data.MCP_MAX_RESULT_ITEMS,
      maxBytes: parsed.data.MCP_MAX_RESPONSE_BYTES
    }
  };
}
