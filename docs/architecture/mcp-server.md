# MCP server architecture

## Status and scope

This document defines the implementation contract for an extensible Model
Context Protocol (MCP) server around `app-store-scraper`.

The first release exposes every current scraper capability over a local stdio
transport. OCR, Apple Ads, and future integrations are optional providers that
reuse the same application and protocol layers. This document does not change
the existing scraper API or runtime behavior.

## Goals

- Cover every current public scraper operation with typed read-only MCP tools.
- Keep MCP protocol code independent from scraping and external API clients.
- Preserve stable public MCP contracts while providers and transports evolve.
- Bound model-driven network activity and response sizes.
- Make credentials, write operations, and remote deployment opt-in and
  auditable.

## Non-goals

- Exposing arbitrary HTTP requests, scraper `requestOptions`, or provider SDKs.
- Adding OCR or Apple Ads to the first App Store-only release.
- Replacing the existing JavaScript scraper API.
- Supporting remote MCP clients before the stdio server is stable.

## Package and layer boundaries

The MCP implementation lives in a separately buildable TypeScript package. The
package targets Node.js 20 or newer, uses the official TypeScript MCP SDK, and
uses Zod as the source of runtime validation and JSON schemas. The existing
scraper package keeps its independently versioned Node.js support policy.

The initial target structure is:

```text
packages/mcp-server/
  src/
    server/
    transports/
    registry/
    application/
    providers/
    schemas/
    errors/
    config/
```

The exact file layout may evolve, but dependencies must point inward:

```text
MCP transport
  -> tool/resource/prompt registry
    -> application services and shared controls
      -> provider interfaces
        -> provider adapters and external systems
```

### Transport

The transport owns process lifecycle and MCP connection setup. It does not
contain tool behavior or provider logic.

Stdio is the initial transport. The client launches one server process and
communicates through newline-delimited MCP JSON-RPC messages:

- stdout contains only valid MCP protocol messages;
- logs and diagnostics use stderr or MCP logging;
- credentials are supplied through environment variables or an injected
  secret provider;
- startup failures and shutdown must not corrupt stdout.

A future Streamable HTTP entry point must reuse the same registry, application
services, schemas, and providers. Remote authentication, sessions, origin
validation, and request limits belong to the HTTP transport and must not alter
tool contracts.

### Registry

The registry declares tools, resources, prompts, schemas, descriptions, and MCP
annotations. Handlers call application services only. Registration may depend
on configured provider capabilities; unavailable optional providers must not
create partially functional tools.

### Application services

Application services coordinate providers and enforce shared controls:

- input normalization after schema validation;
- response projection and size limits;
- cache, timeout, retry, throttle, and cancellation policies;
- normalized errors, logging, and operation timing;
- composition across providers, such as App Store screenshot lookup followed
  by OCR.

### Providers

Providers isolate external systems from MCP and application code. Provider
interfaces use normalized domain schemas and do not expose upstream payloads,
API versions, credentials, headers, or transport-specific errors.

```ts
interface AppStoreProvider {
  getApp(input: GetAppInput): Promise<App>;
  listApps(input: ListAppsInput): Promise<AppSummary[] | App[]>;
  searchApps(input: SearchAppsInput): Promise<App[] | string[]>;
  getDeveloperApps(input: DeveloperAppsInput): Promise<App[]>;
  getPrivacy(input: AppIdInput): Promise<PrivacyDetails>;
  getSuggestions(input: SuggestInput): Promise<Suggestion[]>;
  getSimilarApps(input: AppIdentifierInput): Promise<App[]>;
  getReviews(input: ReviewsInput): Promise<Review[]>;
  getRatings(input: AppIdInput): Promise<Ratings>;
  getVersionHistory(input: AppIdInput): Promise<VersionHistoryItem[]>;
}

interface OcrProvider {
  extractText(input: OcrInput): Promise<OcrResult>;
}

interface AppleAdsProvider {
  // The concrete provider version determines supported capabilities.
  capabilities(): AppleAdsCapabilities;
}
```

Provider construction uses dependency injection so tests can use deterministic
fakes. The first `AppStoreProvider` adapter delegates to this package's public
API.

## Public naming and compatibility

### Names

- Tool and prompt names use namespaced `snake_case`, for example
  `app_store_get_app` and `app_store_analyze_market`.
- Resource URIs use lowercase kebab-case paths under a provider scheme, for
  example `app-store://reference/categories`.
- JSON properties use `camelCase`.
- Provider and domain type names use `PascalCase` internally.
- Public names describe domain behavior, never an upstream endpoint or API
  version.

### Versioning

Adding a tool, resource, prompt, optional input, optional output field, or new
error detail is backward-compatible. Removing or renaming public elements,
changing field meaning or type, making an optional field required, or changing
default behavior is breaking.

Breaking contracts require a new public version:

- tools and prompts add a `_v2` suffix;
- resources add a `/v2/` path segment;
- the previous version remains available for a documented deprecation period.

Provider adapter versions are internal and must not appear in public names. A
provider may add capabilities without changing existing tools. Stable schemas
are validated at both provider and MCP boundaries.

## Shared tool contract

All tools define strict input and output schemas. Unknown input properties are
rejected. Read-only App Store tools use accurate MCP annotations, including
`readOnlyHint: true` and `openWorldHint: true`.

Successful tools return a short human-readable summary and typed structured
content:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 10 apps for \"calendar\" in the US App Store."
    }
  ],
  "structuredContent": {
    "data": [],
    "meta": {
      "provider": "app-store",
      "responseMode": "compact",
      "resultCount": 10,
      "truncated": false
    }
  }
}
```

`meta` may also include `cached`, `nextPage`, and non-sensitive warning codes
when relevant. It must not include credentials, raw request headers, stack
traces, or unbounded upstream payloads.

### Response modes and limits

- Single-object tools default to `full`.
- Collection tools default to `compact`.
- `compact` returns the documented high-value fields for each domain type.
- `full` exposes every normalized field supported by the provider.
- Optional `fields` further projects documented fields after mode selection.
- `maxItems` cannot exceed the server-configured maximum.
- Every response is checked against a server-configured serialized byte limit.
- Truncation is explicit through `meta.truncated`; silent truncation is
  forbidden.

Paging inputs remain operation-specific. Provider pagination tokens must be
normalized before exposure. The application layer, not the transport, enforces
limits.

## Initial App Store tool catalog

The initial catalog covers every current public scraper method.

| Tool | Required input | Optional domain input | Structured data |
| --- | --- | --- | --- |
| `app_store_get_app` | exactly one of `id`, `appId` | `country`, `lang`, `ratings`, response controls | `App` |
| `app_store_list_apps` | none | `collection`, `category`, `country`, `lang`, `num`, `fullDetail`, response controls | `AppSummary[]` or `App[]` |
| `app_store_search_apps` | `term` | `num`, `page`, `country`, `lang`, `idsOnly`, response controls | `App[]` or app IDs |
| `app_store_get_developer_apps` | `devId` | `country`, `lang`, response controls | `App[]` |
| `app_store_get_privacy` | `id` | `country`, response controls | `PrivacyDetails` |
| `app_store_get_suggestions` | `term` | `country`, response controls | `Suggestion[]` |
| `app_store_get_similar_apps` | exactly one of `id`, `appId` | `country`, `lang`, response controls | `App[]` |
| `app_store_get_reviews` | exactly one of `id`, `appId` | `country`, `page`, `sort`, response controls | `Review[]` |
| `app_store_get_ratings` | `id` | `country` | `Ratings` |
| `app_store_get_version_history` | `id` | `country`, response controls | `VersionHistoryItem[]` |

`requestOptions` and raw throttle controls are intentionally absent. Network
policy is server configuration, not model-controlled input.

## Resources and prompts

Reference constants are passive JSON resources generated from package exports:

```text
app-store://reference/categories
app-store://reference/collections
app-store://reference/markets
app-store://reference/devices
app-store://reference/review-sort-orders
```

Resource reads are deterministic and perform no network requests.

Prompts are user-invoked workflow templates. They may recommend tools and
resources but do not execute tools directly. Initial planned prompts cover
market analysis, competitor comparison, listing audit, and review-and-rating
analysis. Prompt instructions must distinguish provider facts from model
analysis and recommendations.

## Errors

Validation failures should be rejected before calling a provider. Operational
failures return `isError: true`, a concise text explanation, and a normalized
structured error without stack traces or secrets.

| Code | Meaning | Retryable |
| --- | --- | --- |
| `INVALID_ARGUMENT` | Input violates a public schema or domain rule | no |
| `NOT_FOUND` | Requested domain object does not exist | no |
| `UPSTREAM_TIMEOUT` | Provider did not complete before the configured timeout | yes |
| `UPSTREAM_RATE_LIMITED` | Provider rejected or delayed the request due to a limit | yes |
| `UPSTREAM_CHANGED` | An upstream response no longer matches the supported format | usually no |
| `AUTH_REQUIRED` | Required provider credentials are missing or expired | after configuration |
| `PERMISSION_DENIED` | Credentials do not allow the requested operation | no |
| `UNSUPPORTED_OPERATION` | Configured provider does not implement the capability | no |
| `RESPONSE_TOO_LARGE` | Result exceeds configured response limits | with narrower input |
| `CANCELLED` | Client cancelled the operation | no |
| `INTERNAL_ERROR` | Unexpected server failure | usually no |

Normalized errors include `code`, `message`, `retryable`, and optional safe
details. Raw provider errors are retained only in redacted internal logs.

## Configuration and operations

Configuration is loaded once at startup from validated environment variables
or injected configuration. Invalid configuration fails startup with diagnostics
on stderr.

Shared configuration includes:

- default country and language;
- request timeout, retries, backoff, and throttling;
- cache TTL and maximum entries;
- maximum result items and serialized response bytes;
- enabled optional providers and write capabilities;
- logging level and redaction policy.

Configuration names are documented when implemented. Tools must not override
network policy, credentials, or provider endpoints.

## Security requirements

### Credentials and logs

- Credentials come only from environment variables or an approved secret
  provider and follow the repository credential policy.
- Secrets, authorization headers, tokens, private keys, and raw credential
  configuration never enter tool results, logs, errors, fixtures, or prompts.
- Logs use operation names, request identifiers, durations, safe provider
  status, and redacted error details.

### URLs, files, and network access

- App Store tools cannot accept arbitrary URLs, headers, methods, or bodies.
- OCR URL inputs use explicit allowed origins, MIME types, byte limits,
  redirects, and timeouts.
- Local-file inputs are disabled by default. If enabled, canonical paths must
  remain under configured roots and reject traversal and symlink escapes.
- Provider clients use configured endpoints; endpoint overrides are
  administrator configuration and are disabled by default.

### Write operations

All initial App Store, OCR, and Apple Ads tools are read-only. Future writes:

- are disabled by default and registered only when explicitly enabled;
- use accurate destructive and idempotent MCP annotations;
- support dry-run or preview before mutation;
- require operation-specific validation and explicit confirmation data for
  destructive or budget-affecting changes;
- produce redacted audit events;
- never expose a generic arbitrary provider request tool.

## Optional provider evolution

### OCR

OCR is a separate provider, not part of `AppStoreProvider`. The normalized
result includes text blocks, confidence, languages, and normalized bounding
boxes. App Store screenshot analysis composes App Store lookup with OCR in the
application layer. The OCR provider controls platform-specific implementation
details such as Tesseract, Apple Vision, or a future approved service.

### Apple Ads

Apple Ads authentication, object models, reporting, and writes remain behind a
version-independent `AppleAdsProvider`.

Campaign Management API 5 is scheduled to sunset on January 26, 2027, while
Apple has announced a replacement Apple Ads Platform API. Public MCP names and
schemas must not contain `v5` or bind directly to retiring endpoint payloads.
The provider advertises capabilities, and API-specific adapters map supported
operations into stable normalized schemas.

Read-only organization, campaign, and report tools precede any write tools.
Apple Ads writes remain separately enabled, validated, previewed, and audited.

## Testing contract

Each implementation ticket includes its relevant tests and documentation:

- schema and application-service unit tests;
- provider contract tests using deterministic fakes;
- adapter tests for normalization and representative provider failures;
- stdio integration tests for discovery and invocation;
- assertions that stdout contains only MCP messages;
- response-limit, cancellation, redaction, and SSRF-related tests;
- opt-in live provider smoke tests that are not required for deterministic CI.

The published stdio package must pass an installation and handshake smoke test
from a temporary project before release.

## Delivery sequence

1. Scaffold the separately packaged TypeScript stdio server.
2. Add provider contracts and the App Store scraper adapter.
3. Expose all App Store tools and reference resources.
4. Apply shared response, network, execution, and security controls.
5. Package and publish the App Store-only stdio server.
6. Add prompts and optional OCR and Apple Ads providers independently.
7. Add Streamable HTTP only after stdio contracts are stable.
