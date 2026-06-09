import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ErrorCode, ProviderError } from '../../errors/index.js';

const credentialsEnvSchema = z.object({
  APPLE_ADS_CLIENT_ID: z.string().trim().min(1),
  APPLE_ADS_TEAM_ID: z.string().trim().min(1),
  APPLE_ADS_KEY_ID: z.string().trim().min(1),
  APPLE_ADS_PRIVATE_KEY: z.string().trim().min(1).optional(),
  APPLE_ADS_PRIVATE_KEY_PATH: z.string().trim().min(1).optional(),
  APPLE_ADS_ORG_ID: z.string().trim().min(1).optional()
});

export type AppleAdsCredentials = {
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
  readonly defaultOrgId?: string;
};

export function isAppleAdsConfigured (env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env['APPLE_ADS_CLIENT_ID'] &&
    env['APPLE_ADS_TEAM_ID'] &&
    env['APPLE_ADS_KEY_ID'] &&
    (env['APPLE_ADS_PRIVATE_KEY'] ?? env['APPLE_ADS_PRIVATE_KEY_PATH'])
  );
}

export function loadAppleAdsCredentials (env: NodeJS.ProcessEnv = process.env): AppleAdsCredentials {
  const parsed = credentialsEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ProviderError(
      ErrorCode.AUTH_REQUIRED,
      'Apple Ads credentials are not configured. Set APPLE_ADS_CLIENT_ID, APPLE_ADS_TEAM_ID, APPLE_ADS_KEY_ID, and APPLE_ADS_PRIVATE_KEY or APPLE_ADS_PRIVATE_KEY_PATH.',
      false
    );
  }

  const { data } = parsed;
  if (!data.APPLE_ADS_PRIVATE_KEY && !data.APPLE_ADS_PRIVATE_KEY_PATH) {
    throw new ProviderError(
      ErrorCode.AUTH_REQUIRED,
      'Set APPLE_ADS_PRIVATE_KEY (PEM content) or APPLE_ADS_PRIVATE_KEY_PATH (path to PEM file).',
      false
    );
  }

  let privateKey: string;
  if (data.APPLE_ADS_PRIVATE_KEY) {
    privateKey = data.APPLE_ADS_PRIVATE_KEY;
  } else {
    try {
      privateKey = readFileSync(data.APPLE_ADS_PRIVATE_KEY_PATH!, 'utf8');
    } catch {
      throw new ProviderError(
        ErrorCode.AUTH_REQUIRED,
        'Apple Ads private key file could not be read. Verify APPLE_ADS_PRIVATE_KEY_PATH.',
        false
      );
    }
  }

  return {
    clientId: data.APPLE_ADS_CLIENT_ID,
    teamId: data.APPLE_ADS_TEAM_ID,
    keyId: data.APPLE_ADS_KEY_ID,
    privateKey,
    ...(data.APPLE_ADS_ORG_ID !== undefined && { defaultOrgId: data.APPLE_ADS_ORG_ID })
  };
}
