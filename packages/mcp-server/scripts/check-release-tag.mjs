import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expected = `mcp-v${packageJson.version}`;

assert.equal(
  process.env.GITHUB_REF_NAME,
  expected,
  `Release tag must be ${expected}`
);
