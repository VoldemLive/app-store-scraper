import { createPrivateKey, createSign } from 'node:crypto';
import type { AppleAdsCredentials } from './credentials.js';
import { ErrorCode, ProviderError } from '../../errors/index.js';

const TOKEN_URL = 'https://appleid.apple.com/auth/oauth2/token';
const CLIENT_SECRET_TTL_SECONDS = 15_778_476; // 6 months
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

type CachedToken = {
  value: string;
  expiresAt: number; // Unix seconds
};

function base64url (buffer: Buffer): string {
  return buffer.toString('base64url');
}

function jsonBase64url (value: unknown): string {
  return base64url(Buffer.from(JSON.stringify(value)));
}

export function generateClientSecretJwt (credentials: AppleAdsCredentials): string {
  const now = Math.floor(Date.now() / 1000);
  const header = jsonBase64url({ alg: 'ES256', kid: credentials.keyId });
  const payload = jsonBase64url({
    sub: credentials.clientId,
    iss: credentials.teamId,
    aud: 'https://appleid.apple.com',
    iat: now,
    exp: now + CLIENT_SECRET_TTL_SECONDS
  });
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey({ key: credentials.privateKey, format: 'pem' });
  const sign = createSign('SHA256');
  sign.update(signingInput);
  // dsaEncoding: 'ieee-p1363' produces r||s format required for ES256 JWT
  const sig = sign.sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64url(sig)}`;
}

export class AppleAdsOAuthClient {
  private readonly credentials: AppleAdsCredentials;
  private cachedToken: CachedToken | null = null;

  constructor (credentials: AppleAdsCredentials) {
    this.credentials = credentials;
  }

  private tokenIsValid (): boolean {
    if (this.cachedToken === null) return false;
    return this.cachedToken.expiresAt > Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_BUFFER_SECONDS;
  }

  async getAccessToken (signal?: AbortSignal): Promise<string> {
    if (this.tokenIsValid()) return this.cachedToken!.value;

    const clientSecret = generateClientSecretJwt(this.credentials);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.credentials.clientId,
      client_secret: clientSecret,
      scope: 'searchadsorg'
    });

    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        ...(signal !== undefined && { signal })
      });
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError(ErrorCode.CANCELLED, 'Token request cancelled', false);
      }
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Apple Ads token request failed', true);
    }

    if (!response.ok) {
      const code = response.status === 403 ? ErrorCode.PERMISSION_DENIED : ErrorCode.AUTH_REQUIRED;
      throw new ProviderError(code, `Apple Ads token request failed: ${response.status}`, false);
    }

    const json = await response.json() as { access_token?: string; expires_in?: number };
    if (typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Malformed Apple Ads token response', false);
    }

    this.cachedToken = {
      value: json.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + json.expires_in
    };

    return this.cachedToken.value;
  }

  invalidate (): void {
    this.cachedToken = null;
  }
}
