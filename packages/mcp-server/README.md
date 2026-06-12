# App Store scraper MCP server

Local Model Context Protocol server that exposes the repository's App Store
scraper over stdio. It is intended to run directly from this checkout and is
not published as a separate npm package.

The server requires Node.js 20.18.1 or newer.

## Setup and launch

From the repository root:

```sh
npm run setup
npm start
```

`npm start` compiles the TypeScript package and starts
`packages/mcp-server/dist/src/cli.js`. Standard output is reserved for MCP
protocol messages; diagnostics are written to standard error.

Useful direct commands:

```sh
npm --prefix packages/mcp-server run build
npm --prefix packages/mcp-server run start
npm --prefix packages/mcp-server run check
```

## Client configuration

Use absolute paths in MCP client configuration. Replace `/path/to/repository`
with this checkout's absolute path.

Claude Desktop and clients using the `mcpServers` JSON format:

```json
{
  "mcpServers": {
    "app-store": {
      "command": "node",
      "args": ["/path/to/repository/packages/mcp-server/dist/src/cli.js"],
      "env": {
        "MCP_LOG_LEVEL": "warn",
        "MCP_REQUEST_TIMEOUT_MS": "10000"
      }
    }
  }
}
```

Codex configuration:

```toml
[mcp_servers.app_store]
command = "node"
args = ["/path/to/repository/packages/mcp-server/dist/src/cli.js"]

[mcp_servers.app_store.env]
MCP_LOG_LEVEL = "warn"
MCP_REQUEST_TIMEOUT_MS = "10000"
```

Run `npm run build` after changing MCP TypeScript sources.

## Capabilities

### App Store tools

Read-only tools for app research and competitive analysis:

- **Discovery:** `app_store_get_app`, `app_store_search_apps`, `app_store_list_apps`,
  `app_store_get_developer_apps`, `app_store_get_suggestions`, `app_store_get_similar_apps`
- **Details:** `app_store_get_reviews`, `app_store_get_ratings`, `app_store_get_privacy`,
  `app_store_get_version_history`
- **Resources:** `app-store://reference/collections`, `categories`, `review-sort-orders`,
  `devices`, `markets`
- **Prompts:** market analysis, competitor comparison, listing audit, review-and-rating analysis

Tool inputs cannot supply arbitrary URLs, HTTP methods, headers, credentials, or raw
scraper `requestOptions`. Country inputs accept only storefronts listed by the
`app-store://reference/markets` resource, are case-insensitive, and default to `us`.

### Market Hunt vector compiler

`market_hunt_vector_compiler` generates a raw application-search lineage from
the versioned YAML seed space in `seeds/market-hunt`.

```yaml
strategy: full_random
random_seed: test-001 # optional
```

The response contains `status: ok`, one independently selected value from each
of the 11 seed categories, and `compiler_version: "1.0"`. Supplying the same
`random_seed` returns the same lineage while the compiler version, seed values,
and file ordering remain unchanged. Omitting it uses system randomness.

The compiler stops at raw randomness. It does not perform semantic
interpretation, compatibility checks, application naming, market analysis,
history, anti-repetition, memory, or decision-making. Those concerns belong to
the calling agent. Internal seed-space loading, reload, and compiler-info
operations are not exposed as MCP tools.

### Apple Ads tools

Market analysis and keyword intelligence tools using the Apple Search Ads API.
Require [credential configuration](#apple-ads). When credentials are absent the server
starts normally and Apple Ads tools return a clear unconfigured error.

| Tool | Purpose |
| --- | --- |
| `apple_ads_get_keyword_suggestions` | Keyword suggestions + bid range signals for any app by Adam ID — including competitors. Core tool for keyword demand analysis and niche competitiveness research. |
| `apple_ads_list_organizations` | List accessible Apple Search Ads organizations. |
| `apple_ads_list_promoted_apps` | List apps promoted under an organization. |
| `apple_ads_list_campaigns` | List campaigns under an organization. |
| `apple_ads_list_ad_groups` | List ad groups within a campaign. |
| `apple_ads_list_keywords` | List targeting keywords for an ad group. |
| `apple_ads_list_creatives` | List creative sets under an organization. |

`apple_ads_get_keyword_suggestions` works against any publicly available app Adam ID
without requiring active campaigns. Pass a competitor's Adam ID to retrieve the keyword
landscape they can be targeted with, along with bid min/max ranges as a competitiveness proxy.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_SERVER_NAME` | `app-store-scraper-mcp` | Server name announced during initialization |
| `MCP_SERVER_VERSION` | `1.0.0` | Server version announced during initialization |
| `MCP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `MCP_REQUEST_TIMEOUT_MS` | `10000` | Upstream timeout from 100 to 120000 milliseconds |
| `MCP_REQUEST_RETRIES` | `2` | GET retry count from 0 to 10 |
| `MCP_REQUEST_RETRY_DELAY_MS` | `250` | Initial retry delay in milliseconds |
| `MCP_REQUEST_MAX_RETRY_DELAY_MS` | `5000` | Maximum retry delay in milliseconds |
| `MCP_REQUEST_THROTTLE_RPS` | `10` | Shared upstream limit from 1 to 100 requests per second |
| `MCP_CACHE_TTL_MS` | `300000` | Successful-result cache TTL; `0` disables caching |
| `MCP_CACHE_MAX_ENTRIES` | `1000` | Maximum cached results; `0` disables caching |
| `MCP_MAX_RESULT_ITEMS` | `50` | Maximum items returned by list-like tools |
| `MCP_MAX_RESPONSE_BYTES` | `1048576` | Maximum serialized structured response size |

Invalid configuration stops startup without echoing environment values.
Environment values in JSON or TOML client configuration must be strings.

## Response controls

All tools accept optional response controls:

- `responseMode`: `compact` or `full`;
- `fields`: select fields from returned objects;
- `maxItems`: reduce list results within the server-side limit.

Successful responses include metadata describing result counts, mode, and
truncation. Oversized responses return `RESPONSE_TOO_LARGE`.

## Security and operations

Network policy is controlled only through validated server environment
variables. Logs include operation names, request identifiers, duration,
outcome, and normalized error codes without tool inputs or credentials.

Apple Ads tools require explicit credential configuration (see [Apple Ads](#apple-ads)).
When credentials are absent the server starts normally and Apple Ads tools return a clear
unconfigured error.

## Apple Ads

Apple Ads tools use the [Apple Search Ads Campaign Management API v5](https://developer.apple.com/documentation/apple_search_ads). All tools are read-only and disabled by default — they activate only when all required credentials are present.

### Required Apple Search Ads role

The Apple ID used to generate the API key must have at least the **Read Only** role in Apple Search Ads. Campaign reporting and write operations require higher roles; see Apple's role documentation for details.

### Generating an API key

1. Sign in to [Apple Search Ads](https://searchads.apple.com) with an Apple ID that has the required role.
2. Open **Settings → API → Public Key**.
3. Click **Create API Certificate**, download the `.p8` private key, and note the **Client ID**, **Team ID**, and **Key ID**.

The private key can only be downloaded once. Store it securely and rotate it if it is ever exposed.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `APPLE_ADS_CLIENT_ID` | Yes | Client ID from the API certificate |
| `APPLE_ADS_TEAM_ID` | Yes | Team ID from the API certificate |
| `APPLE_ADS_KEY_ID` | Yes | Key ID from the API certificate |
| `APPLE_ADS_PRIVATE_KEY` | Either | PEM private key content (inline) |
| `APPLE_ADS_PRIVATE_KEY_PATH` | Either | Path to the `.p8` PEM private key file |

Set `APPLE_ADS_PRIVATE_KEY` or `APPLE_ADS_PRIVATE_KEY_PATH` — not both. Inline PEM is convenient for containerized deployments where mounting a file is impractical.

### Local stdio configuration example

Claude Desktop / `mcpServers` JSON:

```json
{
  "mcpServers": {
    "app-store": {
      "command": "node",
      "args": ["/path/to/repository/packages/mcp-server/dist/src/cli.js"],
      "env": {
        "APPLE_ADS_CLIENT_ID": "SEARCHADS.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "APPLE_ADS_TEAM_ID": "SEARCHADS.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "APPLE_ADS_KEY_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "APPLE_ADS_PRIVATE_KEY_PATH": "/path/to/private-key.p8"
      }
    }
  }
}
```

### Keyword suggestions

`apple_ads_get_keyword_suggestions` is the primary market analysis tool. It calls
`GET /keywords/targeting/suggestions` with any app's Adam ID — including competitor apps —
and returns keyword suggestions with bid range signals.

```
apple_ads_get_keyword_suggestions
  appAdamId    "284882218"           required — any App Store app numeric ID
  matchTypes   ["BROAD", "EXACT"]   optional — filter by match type (default: both)
  limit        20                   optional — results from API, max 100
  offset       0                    optional — pagination
```

Each result includes `text`, `matchType`, and optional `bidMin`/`bidMax` amounts in the
account's currency. Bid ranges are a proxy for keyword competitiveness — higher ranges
indicate more advertiser demand.

Use cases:
- Identify keyword demand in a target niche before launch
- Compare competitiveness across related keyword sets
- Discover keyword opportunities from a competitor's app Adam ID

### Credential rotation

1. Generate a new API certificate in Apple Search Ads.
2. Update `APPLE_ADS_PRIVATE_KEY` or `APPLE_ADS_PRIVATE_KEY_PATH` (and the key ID / client ID if they changed) in your MCP client configuration.
3. Restart the MCP server.
4. Revoke the old certificate in Apple Search Ads once the new credentials are confirmed working.

Access tokens are short-lived (OAuth bearer tokens); there is nothing to rotate for them. Only the long-lived API certificate requires manual rotation.

## Verification

From the repository root:

```sh
npm run check
```

This runs scraper integration tests, secret scanning, MCP lint/build/unit
tests, and stdio integration tests. The stdio tests verify initialization,
tool/resource/prompt discovery, startup failure behavior, and graceful
shutdown.

To inspect the built server interactively:

```sh
cd packages/mcp-server
npx @modelcontextprotocol/inspector node dist/src/cli.js
```

## Troubleshooting

- `MCP server startup failed.`: validate environment variables and run
  `npm start` directly to inspect stderr.
- A client cannot start the server: build it first and use absolute paths for
  both Node.js and `dist/src/cli.js`.
- Requests time out or are rate-limited: adjust the validated timeout, retry,
  and throttle environment variables.
- `RESPONSE_TOO_LARGE`: request compact mode, select fields, or reduce
  `maxItems`.
