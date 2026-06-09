import type { AppleAdsOAuthClient } from './oauth.js';
import { ErrorCode, ProviderError } from '../../errors/index.js';

export const APPLE_ADS_BASE_URL = 'https://api.searchads.apple.com/api/v5';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 30_000;

function mapHttpError (status: number): ProviderError {
  switch (status) {
    case 401: return new ProviderError(ErrorCode.AUTH_REQUIRED, 'Apple Ads authentication failed', false);
    case 403: return new ProviderError(ErrorCode.PERMISSION_DENIED, 'Insufficient Apple Ads permissions', false);
    case 404: return new ProviderError(ErrorCode.NOT_FOUND, 'Apple Ads resource not found', false);
    case 429: return new ProviderError(ErrorCode.UPSTREAM_RATE_LIMITED, 'Apple Ads rate limit exceeded', true);
    default:
      if (status >= 500) {
        return new ProviderError(ErrorCode.INTERNAL_ERROR, `Apple Ads upstream error: ${status}`, true);
      }
      return new ProviderError(ErrorCode.INTERNAL_ERROR, `Unexpected Apple Ads response: ${status}`, false);
  }
}

function backoffMs (attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_DELAY_MS);
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * BASE_DELAY_MS;
  return Math.min(delay + jitter, MAX_DELAY_MS);
}

function sleep (ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false));
    }, { once: true });
  });
}

export type RequestOptions = {
  orgId?: string;
  body?: unknown;
  signal?: AbortSignal;
};

export class AppleAdsHttpClient {
  private readonly oauthClient: AppleAdsOAuthClient;
  private readonly baseUrl: string;

  constructor (oauthClient: AppleAdsOAuthClient, baseUrl: string = APPLE_ADS_BASE_URL) {
    this.oauthClient = oauthClient;
    this.baseUrl = baseUrl;
  }

  async request<T> (method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const { orgId, body, signal } = options;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
      const token = await this.oauthClient.getAccessToken(signal);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      };
      if (orgId !== undefined) headers['X-AP-Context'] = `orgId=${orgId}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          ...(body !== undefined && { body: JSON.stringify(body) }),
          ...(signal !== undefined && { signal })
        });
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ProviderError(ErrorCode.CANCELLED, 'Operation cancelled', false);
        }
        if (attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt), signal);
          continue;
        }
        throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Apple Ads request failed', true);
      }

      if (response.ok) {
        return response.json() as Promise<T>;
      }

      // Stale token — invalidate and retry without counting toward MAX_RETRIES
      if (response.status === 401 && attempt === 0) {
        this.oauthClient.invalidate();
        continue;
      }

      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader !== null ? parseInt(retryAfterHeader, 10) * 1000 : undefined;
      const error = mapHttpError(response.status);

      if (error.retryable && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt, retryAfterMs), signal);
        continue;
      }

      throw error;
    }

    throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Apple Ads request failed after retries', true);
  }

  async get<T> (path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T> (path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }
}
