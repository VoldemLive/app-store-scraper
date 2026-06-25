import type { ServerConfig } from '../config.js';
import type { LogEvent } from './logger.js';
import {
  APP_PAGE_URL_TEMPLATE,
  LOOKUP_URL,
  RATINGS_URL_TEMPLATE,
  REVIEWS_URL_TEMPLATE,
  RSS_CHARTS_URL,
  SEARCH_URL,
  SIMILAR_APPS_URL_TEMPLATE,
  SUGGEST_URL
} from 'app-store-scraper';
import { APPLE_ADS_BASE_URL } from '../providers/apple-ads/http-client.js';
import { APPLE_ADS_TOKEN_URL } from '../providers/apple-ads/oauth.js';

type ConnectionPoint = {
  name: string;
  endpoint: string;
};

export type McpClientConfig = {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env: Record<string, string>;
  }>;
};

const SERVICE_CONNECTIONS: ConnectionPoint[] = [
  { name: 'app-store-lookup', endpoint: LOOKUP_URL },
  { name: 'app-store-search', endpoint: SEARCH_URL },
  { name: 'app-store-suggestions', endpoint: SUGGEST_URL },
  { name: 'app-store-rss-charts', endpoint: RSS_CHARTS_URL },
  { name: 'app-store-reviews', endpoint: REVIEWS_URL_TEMPLATE },
  { name: 'app-store-ratings', endpoint: RATINGS_URL_TEMPLATE },
  { name: 'app-store-page', endpoint: APP_PAGE_URL_TEMPLATE },
  { name: 'app-store-similar-apps', endpoint: SIMILAR_APPS_URL_TEMPLATE },
  { name: 'apple-ads-api', endpoint: APPLE_ADS_BASE_URL },
  { name: 'apple-ads-oauth', endpoint: APPLE_ADS_TOKEN_URL }
];

export function startupConnectionLog (
  config: ServerConfig,
  transport: string,
  clientConfig?: McpClientConfig
): LogEvent {
  const mcpDetails: Record<string, unknown> = {
    transport,
    serverName: config.name,
    serverVersion: config.version,
    connectionHint: transport === 'stdio'
      ? 'Configure your MCP client to launch command/args from clientConfig; stdio has no HTTP URL or port.'
      : 'Use the configured custom transport.'
  };
  if (clientConfig !== undefined) {
    mcpDetails.clientConfig = clientConfig;
  }

  return {
    level: 'info',
    operation: 'mcp_server_startup',
    requestId: 'startup',
    outcome: 'success',
    details: {
      mcp: mcpDetails,
      services: SERVICE_CONNECTIONS,
      request: {
        timeoutMs: config.request.timeoutMs,
        retries: config.request.retries,
        retryDelayMs: config.request.retryDelayMs,
        maxRetryDelayMs: config.request.maxRetryDelayMs,
        throttleRps: config.request.throttleRps
      }
    }
  };
}
