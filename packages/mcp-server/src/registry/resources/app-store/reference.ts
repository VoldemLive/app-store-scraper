import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { collection, category, sort, device, markets } from 'app-store-scraper';

const MIME = 'application/json';

const URI = {
  collections: 'app-store://reference/collections',
  categories: 'app-store://reference/categories',
  sort: 'app-store://reference/sort',
  devices: 'app-store://reference/devices',
  markets: 'app-store://reference/markets'
} as const;

const PAYLOAD = {
  collections: JSON.stringify(collection, null, 2),
  categories: JSON.stringify(category, null, 2),
  sort: JSON.stringify(sort, null, 2),
  devices: JSON.stringify(device, null, 2),
  markets: JSON.stringify(markets, null, 2)
} as const;

export function registerReferenceResources (server: McpServer): void {
  server.resource(
    'app-store-collections',
    URI.collections,
    {
      description: 'App Store chart collection identifiers for use with app_store_list_apps',
      mimeType: MIME
    },
    () => ({
      contents: [{ uri: URI.collections, mimeType: MIME, text: PAYLOAD.collections }]
    })
  );

  server.resource(
    'app-store-categories',
    URI.categories,
    {
      description: 'App Store category numeric IDs for use with app_store_list_apps',
      mimeType: MIME
    },
    () => ({
      contents: [{ uri: URI.categories, mimeType: MIME, text: PAYLOAD.categories }]
    })
  );

  server.resource(
    'app-store-sort',
    URI.sort,
    {
      description: 'Review sort order values for use with app_store_get_reviews',
      mimeType: MIME
    },
    () => ({
      contents: [{ uri: URI.sort, mimeType: MIME, text: PAYLOAD.sort }]
    })
  );

  server.resource(
    'app-store-devices',
    URI.devices,
    {
      description: 'App Store device type identifiers',
      mimeType: MIME
    },
    () => ({
      contents: [{ uri: URI.devices, mimeType: MIME, text: PAYLOAD.devices }]
    })
  );

  server.resource(
    'app-store-markets',
    URI.markets,
    {
      description: 'Apple App Store storefront IDs by country code',
      mimeType: MIME
    },
    () => ({
      contents: [{ uri: URI.markets, mimeType: MIME, text: PAYLOAD.markets }]
    })
  );
}
