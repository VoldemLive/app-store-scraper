# MCP server release process

The stdio MCP server is published independently as `app-store-scraper-mcp`.
Its version does not need to match the root scraper package version.

## Compatibility and semantic versioning

- Patch releases fix implementation defects without changing public behavior.
- Minor releases may add tools, resources, prompts, optional inputs, optional
  output fields, or error details.
- Major releases are required when removing or renaming public elements,
  changing field meaning or type, making optional fields required, or changing
  defaults.
- Breaking tool and prompt contracts should first be introduced under a `_v2`
  name. Breaking resource contracts should first use a `/v2/` URI path.
- Normalized schemas and error codes are public contracts. Provider adapters,
  cache implementation, logging internals, and transports are internal.

## Release checklist

1. Update `packages/mcp-server/package.json` version and the default
   `MCP_SERVER_VERSION` in `packages/mcp-server/src/config.ts` according to
   semver.
2. Update the immutable `app-store-scraper` commit tarball dependency when the
   MCP adapter needs a newer scraper revision.
3. Run `npm run check` and `npm run package:smoke` in `packages/mcp-server`.
4. Review `npm pack --dry-run` and confirm only `dist/src`, README, license, and
   package metadata are present.
5. Merge the release changes, then create and push tag `mcp-v<version>`.
6. The `mcp-release` workflow repeats all checks and publishes with npm
   provenance using the `NPM_TOKEN` repository secret.

Do not reuse or move an existing release tag. Publish a new patch version when
a release must be corrected.
