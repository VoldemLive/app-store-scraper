import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { collection as collectionConst, category as categoryConst, GENRE_GROUPING_MAP } from 'app-store-scraper';
import type { AppStoreProvider } from '../../../providers/app-store/types.js';
import { ErrorCode, ProviderError } from '../../../errors/index.js';
import { responseControlShape, type ResponseControls, type ToolExecutor } from '../../../application/index.js';
import { countryInput } from '../../../schemas/index.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const validCollections = new Set(Object.values(collectionConst));
const validCategories = new Set(Object.values(categoryConst));

const langInput = z.string().optional().describe('Language code for localised fields (default: en-us)');

function controls (
  responseMode?: 'compact' | 'full',
  fields?: string[],
  maxItems?: number
): ResponseControls {
  return {
    ...(responseMode !== undefined && { responseMode }),
    ...(fields !== undefined && { fields }),
    ...(maxItems !== undefined && { maxItems })
  };
}

function requireIdentifier (id?: number, appId?: string): void {
  if ((id === undefined) === (appId === undefined)) {
    throw new ProviderError(ErrorCode.INVALID_ARGUMENT, 'Provide exactly one of id or appId', false);
  }
}

export function registerDiscoveryTools (
  server: McpServer,
  provider: AppStoreProvider,
  executeTool: ToolExecutor
): void {
  server.tool(
    'app_store_get_app',
    'Retrieve full details for a single App Store app by numeric ID or bundle identifier.',
    {
      id: z.number().int().positive().optional()
        .describe('Numeric iTunes app ID (e.g. 284882218)'),
      appId: z.string().min(1).optional()
        .describe('App bundle identifier (e.g. com.facebook.Facebook)'),
      country: countryInput,
      lang: langInput,
      ratings: z.boolean().optional()
        .describe('Include star-rating histogram in the response (default: false)'),
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, appId, country, lang, ratings, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_app', extra, controls(responseMode, fields, maxItems), async signal => {
        requireIdentifier(id, appId);
        const result = await provider.getApp({
          ...(id !== undefined && { id }),
          ...(appId !== undefined && { appId }),
          ...(country !== undefined && { country }),
          ...(lang !== undefined && { lang }),
          ...(ratings !== undefined && { ratings })
        }, { signal });
        const score = result.score !== undefined ? ` · ★${result.score.toFixed(1)}` : '';
        return { text: `${result.title} (${result.appId}) — ${result.developer}${score}`, data: result };
      })
  );

  server.tool(
    'app_store_search_apps',
    'Search the App Store for apps matching a search term.',
    {
      term: z.string().min(1).describe('Search term'),
      num: z.number().int().min(1).max(200).optional()
        .describe('Maximum upstream results (default: 50, max: 200)'),
      page: z.number().int().min(1).optional()
        .describe('Result page number (default: 1)'),
      country: countryInput,
      lang: langInput,
      idsOnly: z.boolean().optional()
        .describe('Return only numeric app IDs instead of full app details'),
      ...responseControlShape
    },
    READ_ONLY,
    async ({ term, num, page, country, lang, idsOnly, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_search_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.searchApps({
          term,
          ...(num !== undefined && { num }),
          ...(page !== undefined && { page }),
          ...(country !== undefined && { country }),
          ...(lang !== undefined && { lang }),
          ...(idsOnly !== undefined && { idsOnly })
        }, { signal });
        const count = results.length;
        const countryLabel = (country ?? 'us').toUpperCase();
        const text = idsOnly === true
          ? `Found ${count} app ID${count !== 1 ? 's' : ''} for "${term}".`
          : `Found ${count} app${count !== 1 ? 's' : ''} for "${term}" in the ${countryLabel} App Store.`;
        return { text, data: results };
      })
  );

  server.tool(
    'app_store_list_apps',
    'List apps from an App Store chart collection. Returns top-chart or new-release listings.',
    {
      collection: z.string()
        .refine(v => validCollections.has(v), { message: 'Invalid collection value' })
        .optional()
        .describe('Chart collection identifier (see app-store://reference/collections)'),
      category: z.number().int()
        .refine(v => validCategories.has(v), { message: 'Invalid category value' })
        .optional()
        .describe('Category numeric ID (see app-store://reference/categories)'),
      country: countryInput,
      lang: langInput,
      num: z.number().int().min(1).max(200).optional()
        .describe('Maximum upstream results (default: 50, max: 200)'),
      fullDetail: z.boolean().optional()
        .describe('Request full app details from the provider (default: false)'),
      ...responseControlShape
    },
    READ_ONLY,
    async ({ collection, category, country, lang, num, fullDetail, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_list_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.listApps({
          ...(collection !== undefined && { collection }),
          ...(category !== undefined && { category }),
          ...(country !== undefined && { country }),
          ...(lang !== undefined && { lang }),
          ...(num !== undefined && { num }),
          ...(fullDetail !== undefined && { fullDetail })
        }, { signal });
        const count = results.length;
        const countryLabel = (country ?? 'us').toUpperCase();
        return {
          text: `Found ${count} app${count !== 1 ? 's' : ''} in ${countryLabel} App Store charts.`,
          data: results
        };
      })
  );

  server.tool(
    'app_store_get_developer_apps',
    'Retrieve all App Store apps published by a specific developer.',
    {
      devId: z.union([
        z.number().int().positive(),
        z.string().min(1)
      ]).describe('Developer numeric iTunes ID'),
      country: countryInput,
      lang: langInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ devId, country, lang, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_developer_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.getDeveloperApps({
          devId,
          ...(country !== undefined && { country }),
          ...(lang !== undefined && { lang })
        }, { signal });
        const count = results.length;
        const developerName = results[0]?.developer ?? String(devId);
        return { text: `Found ${count} app${count !== 1 ? 's' : ''} by ${developerName}.`, data: results };
      })
  );

  server.tool(
    'app_store_get_suggestions',
    'Retrieve App Store search suggestions for a partial search term.',
    {
      term: z.string().min(1).describe('Partial search term to get suggestions for'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ term, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_suggestions', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.getSuggestions({
          term,
          ...(country !== undefined && { country })
        }, { signal });
        const count = results.length;
        return { text: `Found ${count} suggestion${count !== 1 ? 's' : ''} for "${term}".`, data: results };
      })
  );

  server.tool(
    'app_store_get_similar_apps',
    'Retrieve App Store apps that users also bought alongside a given app.',
    {
      id: z.number().int().positive().optional()
        .describe('Numeric iTunes app ID'),
      appId: z.string().min(1).optional()
        .describe('App bundle identifier'),
      country: countryInput,
      lang: langInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, appId, country, lang, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_similar_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        requireIdentifier(id, appId);
        const results = await provider.getSimilarApps({
          ...(id !== undefined && { id }),
          ...(appId !== undefined && { appId }),
          ...(country !== undefined && { country }),
          ...(lang !== undefined && { lang })
        }, { signal });
        const count = results.length;
        const label = id !== undefined ? String(id) : (appId ?? '');
        return { text: `Found ${count} app${count !== 1 ? 's' : ''} similar to ${label}.`, data: results };
      })
  );

  server.tool(
    'app_store_get_genres',
    'Retrieve the App Store genre/category tree from Apple. Returns official categories and their subcategories (Games, Magazines & Newspapers, and Stickers have subcategories). Cached for 24 hours. See app-store://reference/categories for static IDs.',
    {
      genreId: z.number().int().positive().optional()
        .describe('Genre numeric ID to fetch (default: 36 = App Store root, returns full tree)'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ genreId, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_genres', extra, controls(responseMode, fields, maxItems), async signal => {
        const result = await provider.getGenres({
          ...(genreId !== undefined && { genreId }),
          ...(country !== undefined && { country })
        }, { signal });
        const subCount = result.subcategories?.length ?? 0;
        const sub = subCount > 0 ? ` with ${subCount} subcategories` : '';
        return { text: `Genre "${result.name}" (${result.id})${sub}.`, data: result };
      })
  );

  const validGroupingGenreIds = new Set(Object.keys(GENRE_GROUPING_MAP).map(Number));

  server.tool(
    'app_store_get_grouping',
    'Retrieve Apple\'s editorial grouping (curated sections) for an App Store category. Returns named sections (rooms) that Apple uses to organise apps within a genre. These are editorial, not official taxonomy — available for 18 main iOS genres only. See app-store://reference/groupings for the genreId → groupingId map. Cached for 4 hours.',
    {
      genreId: z.number().int().positive()
        .refine(v => validGroupingGenreIds.has(v), { message: 'No editorial grouping for this genreId — see app-store://reference/groupings' })
        .optional()
        .describe('Genre numeric ID (e.g. 6012 for Lifestyle). See app-store://reference/groupings'),
      groupingId: z.number().int().positive().optional()
        .describe('Apple grouping ID (direct, bypasses genreId lookup)'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ genreId, groupingId, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_grouping', extra, controls(responseMode, fields, maxItems), async signal => {
        if ((genreId === undefined) === (groupingId === undefined)) {
          throw new ProviderError(ErrorCode.INVALID_ARGUMENT, 'Provide exactly one of genreId or groupingId', false);
        }
        const result = await provider.getGrouping({
          ...(genreId !== undefined && { genreId }),
          ...(groupingId !== undefined && { groupingId }),
          ...(country !== undefined && { country })
        }, { signal });
        const count = result.sections.length;
        return {
          text: `Found ${count} editorial section${count !== 1 ? 's' : ''} for genre ${result.genreId}.`,
          data: result
        };
      })
  );

  server.tool(
    'app_store_get_room_apps',
    'Retrieve apps within a specific editorial section (room) of an App Store grouping. Apps are returned in Apple\'s curated order — use the array index to pick by position. Apple caps rooms at ~32 apps; these are editorial picks, not the full category catalogue. Use app_store_get_grouping first to obtain roomId values.',
    {
      roomId: z.string().min(1)
        .describe('Room ID (fcId) from app_store_get_grouping sections'),
      genreId: z.number().int().positive().optional()
        .describe('Genre numeric ID of the parent grouping (recommended for accurate results)'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ roomId, genreId, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_room_apps', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.getRoomApps({
          roomId,
          ...(genreId !== undefined && { genreId }),
          ...(country !== undefined && { country })
        }, { signal });
        const count = results.length;
        return {
          text: `Found ${count} app${count !== 1 ? 's' : ''} in room ${roomId}.`,
          data: results
        };
      })
  );
}
