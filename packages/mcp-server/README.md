# app-store-scraper MCP server

This package exposes `app-store-scraper` tools and reference resources through
an MCP server over stdio.

The package requires Node.js 20 or newer.

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

## Verification

```sh
npm run lint
npm test
```

The end-to-end tests launch the compiled executable as a child process and
verify initialization, ping, startup failure output, and graceful shutdown.
