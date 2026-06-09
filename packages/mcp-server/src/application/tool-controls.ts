import { z } from 'zod';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from '../config.js';
import { ErrorCode, ProviderError } from '../errors/index.js';
import { requestId, type Logger } from './logger.js';

const COMPACT_FIELDS = [
  'id', 'appId', 'title', 'developer', 'developerId', 'primaryGenre',
  'genre', 'price', 'currency', 'free', 'score', 'reviews', 'version',
  'updated', 'released', 'term', 'versionDisplay', 'releaseDate', 'userName'
];

export const responseControlShape = {
  responseMode: z.enum(['compact', 'full']).optional()
    .describe('Response detail level (default: compact for lists)'),
  fields: z.array(z.string().min(1)).max(50).optional()
    .describe('Optional fields to include in each returned object'),
  maxItems: z.number().int().min(1).max(200).optional()
    .describe('Maximum items to include, bounded by server configuration')
};

export type ResponseControls = {
  responseMode?: 'compact' | 'full';
  fields?: string[];
  maxItems?: number;
};

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

type ToolValue = {
  text: string;
  data: unknown;
  resultCount?: number;
};

function normalizedError (error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && /aborted|cancelled/i.test(error.message))
  ) {
    return new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
  }
  return new ProviderError(ErrorCode.INTERNAL_ERROR, 'Unexpected server error', false);
}

function projectObject (value: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter(field => field in value).map(field => [field, value[field]]));
}

function projectData (data: unknown, controls: ResponseControls): unknown {
  const fields = controls.fields ?? (controls.responseMode === 'full' ? undefined : COMPACT_FIELDS);
  if (fields === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(value => value !== null && typeof value === 'object'
      ? projectObject(value as Record<string, unknown>, fields)
      : value);
  }
  if (data !== null && typeof data === 'object') {
    return projectObject(data as Record<string, unknown>, fields);
  }
  return data;
}

export function toolError (error: unknown) {
  const value = normalizedError(error);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `Error [${value.code}]: ${value.message}` }],
    structuredContent: {
      error: {
        code: value.code,
        message: value.message,
        retryable: value.retryable
      }
    }
  };
}

export function createToolExecutor (config: ServerConfig, logger: Logger) {
  return async function executeTool (
    operation: string,
    extra: Extra,
    controls: ResponseControls,
    action: (signal: AbortSignal) => Promise<ToolValue>
  ) {
    const id = requestId(extra.requestId);
    const started = Date.now();

    try {
      if (extra.signal.aborted) {
        throw new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
      }

      const result = await action(extra.signal);
      const originalCount = Array.isArray(result.data)
        ? result.data.length
        : (result.resultCount ?? 1);
      const limit = Math.min(controls.maxItems ?? config.response.maxItems, config.response.maxItems);
      const limited = Array.isArray(result.data) ? result.data.slice(0, limit) : result.data;
      const responseMode = controls.responseMode ?? (Array.isArray(result.data) ? 'compact' : 'full');
      const data = projectData(limited, { ...controls, responseMode });
      const returnedCount = Array.isArray(data) ? data.length : (result.resultCount ?? 1);
      const structuredContent = {
        data,
        meta: {
          provider: 'app-store',
          responseMode,
          resultCount: returnedCount,
          totalCount: originalCount,
          truncated: originalCount > returnedCount
        }
      };

      if (Buffer.byteLength(JSON.stringify(structuredContent)) > config.response.maxBytes) {
        throw new ProviderError(
          ErrorCode.RESPONSE_TOO_LARGE,
          'Response exceeds the configured size limit',
          false
        );
      }

      logger.log({
        level: 'info',
        operation,
        requestId: id,
        durationMs: Date.now() - started,
        outcome: 'success'
      });
      return {
        content: [{ type: 'text' as const, text: result.text }],
        structuredContent
      };
    } catch (error) {
      const value = normalizedError(error);
      logger.log({
        level: 'warn',
        operation,
        requestId: id,
        durationMs: Date.now() - started,
        outcome: 'error',
        code: value.code
      });
      return toolError(value);
    }
  };
}

export type ToolExecutor = ReturnType<typeof createToolExecutor>;
