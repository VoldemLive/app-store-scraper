import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { collection, category, sort, device, markets } from 'app-store-scraper';

const MIME = 'application/json';

function json (data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function registerReferenceResources (server: McpServer): void {
  server.resource(
    'app-store-collections',
    'app-store://reference/collections',
    {
      description: 'App Store chart collection identifiers for use with app_store_list_apps',
      mimeType: MIME
    },
    (_uri) => ({
      contents: [{ uri: 'app-store://reference/collections', mimeType: MIME, text: json(collection) }]
    })
  );

  server.resource(
    'app-store-categories',
    'app-store://reference/categories',
    {
      description: 'App Store category numeric IDs for use with app_store_list_apps',
      mimeType: MIME
    },
    (_uri) => ({
      contents: [{ uri: 'app-store://reference/categories', mimeType: MIME, text: json(category) }]
    })
  );

  server.resource(
    'app-store-sort',
    'app-store://reference/sort',
    {
      description: 'Review sort order values for use with app_store_get_reviews',
      mimeType: MIME
    },
    (_uri) => ({
      contents: [{ uri: 'app-store://reference/sort', mimeType: MIME, text: json(sort) }]
    })
  );

  server.resource(
    'app-store-devices',
    'app-store://reference/devices',
    {
      description: 'App Store device type identifiers',
      mimeType: MIME
    },
    (_uri) => ({
      contents: [{ uri: 'app-store://reference/devices', mimeType: MIME, text: json(device) }]
    })
  );

  server.resource(
    'app-store-markets',
    'app-store://reference/markets',
    {
      description: 'Apple App Store storefront IDs by country code',
      mimeType: MIME
    },
    (_uri) => ({
      contents: [{ uri: 'app-store://reference/markets', mimeType: MIME, text: json(markets) }]
    })
  );
}
