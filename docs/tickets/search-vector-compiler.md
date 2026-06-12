# Search Vector Compiler Tickets

Draft tickets. Do not publish without explicit approval.

## Feature: Add raw seed lineage compiler

When an agent requests a raw search vector, I want the compiler to
independently select one seed from every category, so I can perform semantic
interpretation outside the compiler.

### Acceptance Criteria

- The compiler loads and validates the 11 versioned YAML seed files in
  `packages/mcp-server/seeds/search-vector`.
- Every seed file is a non-empty YAML list of unique English `snake_case` strings.
- `compileVector()` accepts `strategy: full_random` and an optional
  `random_seed`.
- Every compilation selects exactly one value from each seed category.
- Calls without `random_seed` use system randomness.
- The same `random_seed` produces the same lineage across calls and server
  restarts while compiler version, seed contents, and ordering remain unchanged.
- The response contains `status`, the raw 11-field `seed_lineage`, and compiler
  metadata.
- Internal `getSeedSpace()`, `reloadSeedSpace()`, and `compilerInfo()` operations
  are available without being exposed as MCP tools.
- Missing, malformed, empty, duplicate, or invalid seed records fail without
  returning a partial lineage.
- Unit tests cover loading, validation, random compilation, deterministic
  compilation, reload, and metadata.

### Notes

- Semantic interpretation, compatibility checks, history, anti-repetition,
  memory, naming, market research, and decisions are excluded.
- Weighting and compatibility graphs are future work.

## Feature: Expose raw vector compilation through MCP

When an agent needs a new raw search vector, I want to invoke one MCP tool, so I
can evaluate and interpret the lineage independently.

### Acceptance Criteria

- The MCP server always exposes `search_vector_compiler`.
- The tool accepts only `strategy: full_random` and optional `random_seed`.
- Invalid input returns a normalized MCP error.
- The tool returns the compiler response without semantic interpretation.
- The tool performs no network requests and does not depend on App Store or
  Apple Ads providers.
- Internal compiler operations are not exposed as MCP tools.
- MCP tests cover discovery, input validation, deterministic output, and the
  complete lineage contract.
- MCP documentation describes usage, boundaries, deterministic seeds, and
  excluded responsibilities.

### Notes

- Depends on `Feature: Add raw seed lineage compiler`.
- A future REST transport may reuse the underlying `status: ok` response.
