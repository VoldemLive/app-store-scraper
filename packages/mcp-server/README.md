# app-store-scraper MCP server

This package exposes `app-store-scraper` tools and reference resources through
an MCP server over stdio.

The package requires Node.js 20.18.1 or newer.

## Run with npx

Pin the version in client configuration for reproducible startup:

```sh
npx -y app-store-scraper-mcp@0.1.0
```

For a direct installation:

```sh
npm install --global app-store-scraper-mcp@0.1.0
app-store-mcp
```

## Client configuration

Claude Desktop and other clients that use the `mcpServers` JSON format:

```json
{
  "mcpServers": {
    "app-store": {
      "command": "npx",
      "args": ["-y", "app-store-scraper-mcp@0.1.0"],
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
command = "npx"
args = ["-y", "app-store-scraper-mcp@0.1.0"]

[mcp_servers.app_store.env]
MCP_LOG_LEVEL = "warn"
MCP_REQUEST_TIMEOUT_MS = "10000"
```

## Local development

```sh
npm ci
npm run build
node dist/src/cli.js
```

The executable reserves stdout exclusively for MCP protocol messages.
Operational and fatal diagnostics are written to stderr.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_SERVER_NAME` | `app-store-scraper-mcp` | Server name announced during MCP initialization |
| `MCP_SERVER_VERSION` | `0.1.0` | Server version announced during MCP initialization |
| `MCP_LOG_LEVEL` | `info` | One of `debug`, `info`, `warn`, or `error` |
| `MCP_REQUEST_TIMEOUT_MS` | `10000` | Upstream request timeout from 100 to 120000 milliseconds |
| `MCP_REQUEST_RETRIES` | `2` | GET retry count from 0 to 10 |
| `MCP_REQUEST_RETRY_DELAY_MS` | `250` | Initial retry delay in milliseconds |
| `MCP_REQUEST_MAX_RETRY_DELAY_MS` | `5000` | Maximum retry delay in milliseconds |
| `MCP_REQUEST_THROTTLE_RPS` | `10` | Shared upstream request limit from 1 to 100 requests per second |
| `MCP_CACHE_TTL_MS` | `300000` | Successful-result cache TTL in milliseconds; `0` disables caching |
| `MCP_CACHE_MAX_ENTRIES` | `1000` | Maximum cached results; `0` disables caching |
| `MCP_MAX_RESULT_ITEMS` | `50` | Server-side maximum items returned by list-like tools |
| `MCP_MAX_RESPONSE_BYTES` | `1048576` | Maximum serialized structured response size |

Invalid configuration stops startup and writes a generic diagnostic to stderr
without echoing environment values.

Environment values in JSON or TOML client configuration must be strings.

## Response controls

All tools accept optional response controls:

- `responseMode`: `compact` or `full`. List-like tools default to `compact`;
  object tools default to `full`.
- `fields`: selects fields from returned objects without changing the upstream
  request.
- `maxItems`: reduces list results up to the server-side
  `MCP_MAX_RESULT_ITEMS` limit.

Every successful result includes metadata describing the response mode, result
count, upstream total count, and whether the result was truncated. Responses
that exceed `MCP_MAX_RESPONSE_BYTES` return `RESPONSE_TOO_LARGE`.

## Security and operations

Network policy is controlled only by validated server environment variables.
Tool schemas do not accept arbitrary URLs, HTTP methods, headers, credentials,
or raw scraper `requestOptions`. The adapter applies timeout, retry, shared
throttle, cache, and MCP cancellation controls internally.

Operational logs are JSON lines written to stderr. They include the operation,
request identifier, duration, outcome, and normalized error code, but do not
include tool input values, credentials, or configuration values. Timeout,
rate-limit, cancellation, oversized-response, and provider failures use stable
normalized error codes.

## MCP Inspector

Build the package, then launch the server through MCP Inspector:

```sh
npx @modelcontextprotocol/inspector node dist/src/cli.js
```

The Inspector can initialize the server, list its App Store tools and reference
resources, and invoke them.

## Prompts

Prompts are user-invoked workflow templates. They recommend read-only tools and
resources but do not execute tools themselves.

| Prompt | Required input | Tools it may invoke |
| --- | --- | --- |
| `app_store_analyze_market` | `term` | `app_store_search_apps`, `app_store_list_apps`, `app_store_get_app` |
| `app_store_compare_competitors` | `appIdentifiers` | `app_store_get_app`, `app_store_get_ratings`, `app_store_get_privacy`, `app_store_get_version_history`, `app_store_get_similar_apps` |
| `app_store_audit_listing` | `appIdentifier` | `app_store_get_app`, `app_store_get_ratings`, `app_store_get_privacy`, `app_store_get_version_history`, `app_store_get_similar_apps` |
| `app_store_analyze_reviews_and_ratings` | `appIdentifier` | `app_store_get_reviews`, `app_store_get_ratings`, `app_store_get_app`, `app_store_get_version_history` |

Each prompt accepts an optional two-letter `country`. Market analysis also
accepts an optional `category`. Prompt instructions require sourced facts,
analysis, recommendations, and data gaps to be reported separately.

## Verification

```sh
npm run check
npm run package:smoke
```

The end-to-end tests launch the compiled executable as a child process and
verify initialization, ping, startup failure output, and graceful shutdown.
The package smoke test packs the artifact, verifies its contents and executable
permissions, installs it into a temporary project, and completes a stdio
handshake.

## Troubleshooting

- `MCP server startup failed.`: validate environment variable values and run
  the pinned `npx` command directly to inspect stderr.
- Client cannot find `npx` or `app-store-mcp`: use an absolute executable path
  in the client configuration or install Node.js 20.18.1+ for the client
  process.
- Requests time out or are rate-limited: adjust the validated
  `MCP_REQUEST_TIMEOUT_MS`, `MCP_REQUEST_RETRIES`, and
  `MCP_REQUEST_THROTTLE_RPS` server settings.
- Client receives `RESPONSE_TOO_LARGE`: request compact mode, select fields, or
  reduce `maxItems`; raise the server limit only when the client can handle it.

## Upgrading

Change the pinned package version, restart the MCP client, and verify its tool
and resource list before relying on new capabilities. Patch releases preserve
public behavior, minor releases may add optional capabilities, and major
releases may contain breaking contract changes. See the repository's
`docs/mcp-release.md` for the full compatibility and release policy.
