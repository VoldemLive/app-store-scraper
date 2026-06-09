import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreProvider } from '../../../providers/app-store/types.js';
import { ProviderError } from '../../../errors/index.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const countryInput = z.string().length(2).optional().describe('Two-letter ISO country code (default: us)');

function ok (text: string, data: unknown, resultCount: number) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: {
      data,
      meta: { provider: 'app-store', resultCount, truncated: false }
    }
  };
}

function fail (error: unknown) {
  const e = error instanceof ProviderError
    ? error
    : new ProviderError('INTERNAL_ERROR' as const, 'Unexpected server error', false);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `Error [${e.code}]: ${e.message}` }],
    structuredContent: { error: { code: e.code, message: e.message, retryable: e.retryable } }
  };
}

export function registerDetailsTools (server: McpServer, provider: AppStoreProvider): void {
  server.tool(
    'app_store_get_reviews',
    'Retrieve user reviews for an App Store app by numeric ID or bundle identifier.',
    {
      id: z.number().int().positive().optional()
        .describe('Numeric iTunes app ID'),
      appId: z.string().min(1).optional()
        .describe('App bundle identifier (e.g. com.facebook.Facebook)'),
      country: countryInput,
      page: z.number().int().min(1).max(10).optional()
        .describe('Review page number, 1–10 (default: 1)'),
      sort: z.enum(['mostRecent', 'mostHelpful']).optional()
        .describe('Sort order: mostRecent (default) or mostHelpful')
    },
    READ_ONLY,
    async ({ id, appId, country, page, sort }) => {
      if (id === undefined && appId === undefined) {
        return fail(new ProviderError('INVALID_ARGUMENT' as const, 'Provide exactly one of id or appId', false));
      }
      try {
        const results = await provider.getReviews({
          ...(id !== undefined && { id }),
          ...(appId !== undefined && { appId }),
          ...(country !== undefined && { country }),
          ...(page !== undefined && { page }),
          ...(sort !== undefined && { sort })
        });
        const count = results.length;
        const label = id !== undefined ? String(id) : (appId ?? '');
        return ok(`Found ${count} review${count !== 1 ? 's' : ''} for ${label}.`, results, count);
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.tool(
    'app_store_get_ratings',
    'Retrieve star-rating statistics for an App Store app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput
    },
    READ_ONLY,
    async ({ id, country }) => {
      try {
        const result = await provider.getRatings({
          id,
          ...(country !== undefined && { country })
        });
        return ok(`Ratings for app ${id}: ${result.ratings} rating(s).`, result, 1);
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.tool(
    'app_store_get_privacy',
    'Retrieve App Store privacy disclosure data for an app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput
    },
    READ_ONLY,
    async ({ id, country }) => {
      try {
        const result = await provider.getPrivacy({
          id,
          ...(country !== undefined && { country })
        });
        const count = result.privacyTypes.length;
        return ok(`Found ${count} privacy type${count !== 1 ? 's' : ''} for app ${id}.`, result, count);
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.tool(
    'app_store_get_version_history',
    'Retrieve the version history for an App Store app.',
    {
      id: z.number().int().positive().describe('Numeric iTunes app ID'),
      country: countryInput
    },
    READ_ONLY,
    async ({ id, country }) => {
      try {
        const results = await provider.getVersionHistory({
          id,
          ...(country !== undefined && { country })
        });
        const count = results.length;
        return ok(`Found ${count} version${count !== 1 ? 's' : ''} for app ${id}.`, results, count);
      } catch (error) {
        return fail(error);
      }
    }
  );
}
