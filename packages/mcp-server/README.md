# app-store-scraper MCP server

This package is the TypeScript MCP server for `app-store-scraper`. The current
scaffold provides an empty provider-independent registry over stdio. App Store
tools and resources are added in follow-up implementation tickets.

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

Invalid configuration stops startup and writes a generic diagnostic to stderr
without echoing environment values.

## MCP Inspector

Build the package, then launch the server through MCP Inspector:

```sh
npx @modelcontextprotocol/inspector node dist/src/cli.js
```

The Inspector can complete initialization and ping the server. The registry is
intentionally empty until provider contracts and App Store tools are added.

## Verification

```sh
npm run lint
npm test
```

The end-to-end tests launch the compiled executable as a child process and
verify initialization, ping, startup failure output, and graceful shutdown.
