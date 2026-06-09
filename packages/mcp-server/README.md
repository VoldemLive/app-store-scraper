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

The server exposes all current App Store scraper operations:

- discovery tools for app details, search, charts, developer apps,
  suggestions, and similar apps;
- detail tools for reviews, ratings, privacy disclosures, and version history;
- passive reference resources for collections, categories, review sort orders,
  devices, and markets;
- prompts for market analysis, competitor comparison, listing audit, and
  review-and-rating analysis.

All App Store tools are read-only. Tool inputs cannot supply arbitrary URLs,
HTTP methods, headers, credentials, or raw scraper `requestOptions`.
App Store tool country inputs accept only storefronts listed by the
`app-store://reference/markets` resource, are case-insensitive, and default to
`us` when omitted.

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

Apple Ads is an extension contract stub only. The default server does not read
Apple Ads credentials, perform OAuth, make Apple Ads requests, or expose
`apple_ads_*` tools. OCR and Streamable HTTP are deferred.

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
