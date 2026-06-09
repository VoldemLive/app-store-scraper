# Apple Ads provider

The MCP server includes a version-independent `AppleAdsProvider` interface and a
`CampaignManagementV5Provider` adapter that calls the Apple Ads Campaign
Management API v5. The provider is loaded automatically when the required
environment variables are present; otherwise an `UnsupportedAppleAdsProvider`
is returned and all Apple Ads operations fail with a descriptive error.

## Authentication

Apple Ads uses OAuth 2.0 client credentials. The flow is:

1. Sign a short-lived client secret JWT (ES256) with your private key.
2. Exchange it for an access token at `https://appleid.apple.com/auth/oauth2/token`.
3. Pass the access token as `Authorization: Bearer <token>` on every API request.
4. Tokens expire in 3 600 seconds. The client caches them and refreshes automatically.

## Required Apple Ads roles

To use the read-only API operations you need at least the **Read Only** role on
the organizations you want to query. Reporting additionally requires the
**Reporting** role. Write operations (not yet exposed via MCP tools) require
**Admin** or **Campaign Manager**.

Roles are granted in the Apple Ads UI under **Settings → Users**.

## Credential setup

### Create an API key

1. Sign in to [Apple Search Ads](https://searchads.apple.com).
2. Go to **Settings → API** (or **Account Settings → API**).
3. Click **Create API Certificate**.
4. Download the `.p8` private key file. **This is the only chance to download it.**
5. Note the **Client ID**, **Team ID**, and **Key ID** shown in the UI.

### Store credentials outside the repository

```sh
# Copy the downloaded key to a directory outside the repo
cp ~/Downloads/AuthKey_KEYID.p8 ~/.apple-ads/private-key.p8
chmod 600 ~/.apple-ads/private-key.p8
```

### Set environment variables

Copy `.env.example` and fill in real values:

```sh
APPLE_ADS_CLIENT_ID=SEARCHADS.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APPLE_ADS_TEAM_ID=ABCDE12345
APPLE_ADS_KEY_ID=ABCDE12345
APPLE_ADS_ORG_ID=1234567          # optional default organization
APPLE_ADS_PRIVATE_KEY_PATH=/absolute/path/outside/repository/private-key.p8
```

Alternatively, pass the PEM content inline (for CI secret injection):

```sh
APPLE_ADS_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
```

When both `APPLE_ADS_PRIVATE_KEY` and `APPLE_ADS_PRIVATE_KEY_PATH` are set,
the inline value takes precedence.

### Local stdio launch

```sh
APPLE_ADS_CLIENT_ID=... \
APPLE_ADS_TEAM_ID=... \
APPLE_ADS_KEY_ID=... \
APPLE_ADS_PRIVATE_KEY_PATH=~/.apple-ads/private-key.p8 \
node packages/mcp-server/dist/src/cli.js
```

## Credential rotation

When you rotate an API key:

1. Create a new key in the Apple Ads UI before revoking the old one.
2. Update `APPLE_ADS_KEY_ID` and the private key file/variable.
3. Restart the MCP server process to pick up the new credentials.
4. Revoke the old key in the Apple Ads UI.

After rotation the `AppleAdsOAuthClient` will automatically obtain new tokens on
the next request.

## API versioning

`CampaignManagementV5Provider` targets Apple Ads Campaign Management API **v5**
(`https://api.searchads.apple.com/api/v5`). Apple has announced a new Apple Ads
Platform API to replace Campaign Management API v5 before **January 26, 2027**.

All API-version-specific code lives behind the `AppleAdsProvider` interface. A
migration plan will be produced as part of the research captured in the
corresponding migration-strategy ticket before the sunset date.

## Provider factory

```typescript
import { createAppleAdsProvider } from 'app-store-scraper-mcp/providers';

const provider = createAppleAdsProvider(process.env);
// Returns CampaignManagementV5Provider when credentials present,
// UnsupportedAppleAdsProvider otherwise.
```

## Error codes

| Situation | ErrorCode |
|---|---|
| Missing or invalid credentials | `AUTH_REQUIRED` |
| Insufficient permissions | `PERMISSION_DENIED` |
| Resource not found | `NOT_FOUND` |
| Rate limit exceeded | `UPSTREAM_RATE_LIMITED` |
| Transient upstream error | `INTERNAL_ERROR` (retryable) |
| Cancelled via AbortSignal | `CANCELLED` |

## Security

See [`docs/security/apple-ads-credentials.md`](../security/apple-ads-credentials.md)
for credential-storage rules, incident-response guidance, and scanner usage.
