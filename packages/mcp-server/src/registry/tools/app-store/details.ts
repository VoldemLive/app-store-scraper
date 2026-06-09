import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreProvider } from '../../../providers/app-store/types.js';
import { ErrorCode, ProviderError } from '../../../errors/index.js';
import { responseControlShape, type ResponseControls, type ToolExecutor } from '../../../application/index.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
const countryInput = z.string().length(2).optional().describe('Two-letter ISO country code (default: us)');

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

export function registerDetailsTools (
  server: McpServer,
  provider: AppStoreProvider,
  executeTool: ToolExecutor
): void {
  server.tool(
    'app_store_get_reviews',
    'Retrieve user reviews for an App Store app by numeric ID or bundle identifier.',
    {
      id: z.number().int().positive().optional().describe('Numeric iTunes app ID'),
      appId: z.string().min(1).optional().describe('App bundle identifier'),
      country: countryInput,
      page: z.number().int().min(1).max(10).optional().describe('Review page number, 1–10 (default: 1)'),
      sort: z.enum(['mostRecent', 'mostHelpful']).optional().describe('Review sort order'),
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, appId, country, page, sort, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_reviews', extra, controls(responseMode, fields, maxItems), async signal => {
        requireIdentifier(id, appId);
        const results = await provider.getReviews({
          ...(id !== undefined && { id }),
          ...(appId !== undefined && { appId }),
          ...(country !== undefined && { country }),
          ...(page !== undefined && { page }),
          ...(sort !== undefined && { sort })
        }, { signal });
        const count = results.length;
        const label = id !== undefined ? String(id) : (appId ?? '');
        return { text: `Found ${count} review${count !== 1 ? 's' : ''} for ${label}.`, data: results };
      })
  );

  server.tool(
    'app_store_get_ratings',
    'Retrieve star-rating statistics for an App Store app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_ratings', extra, controls(responseMode, fields, maxItems), async signal => {
        const result = await provider.getRatings({
          id,
          ...(country !== undefined && { country })
        }, { signal });
        return { text: `Ratings for app ${id}: ${result.ratings} rating(s).`, data: result };
      })
  );

  server.tool(
    'app_store_get_privacy',
    'Retrieve App Store privacy disclosure data for an app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_privacy', extra, controls(responseMode, fields, maxItems), async signal => {
        const result = await provider.getPrivacy({
          id,
          ...(country !== undefined && { country })
        }, { signal });
        const count = result.privacyTypes.length;
        return { text: `Found ${count} privacy type${count !== 1 ? 's' : ''} for app ${id}.`, data: result, resultCount: count };
      })
  );

  server.tool(
    'app_store_get_version_history',
    'Retrieve the version history for an App Store app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput,
      ...responseControlShape
    },
    READ_ONLY,
    async ({ id, country, responseMode, fields, maxItems }, extra) =>
      executeTool('app_store_get_version_history', extra, controls(responseMode, fields, maxItems), async signal => {
        const results = await provider.getVersionHistory({
          id,
          ...(country !== undefined && { country })
        }, { signal });
        const count = results.length;
        return { text: `Found ${count} version${count !== 1 ? 's' : ''} for app ${id}.`, data: results };
      })
  );
}
