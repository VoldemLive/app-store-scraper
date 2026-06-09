#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  {
    name: 'private key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/
  },
  {
    name: 'assigned client secret',
    pattern: /\bclient[_-]?secret\b\s*[:=]\s*["']?(?!your-|example|placeholder|<)[A-Za-z0-9._~+/=-]{16,}/i
  },
  {
    name: 'assigned access token',
    pattern: /\baccess[_-]?token\b\s*[:=]\s*["']?(?!your-|example|placeholder|<)[A-Za-z0-9._~+/=-]{16,}/i
  },
  {
    name: 'assigned refresh token',
    pattern: /\brefresh[_-]?token\b\s*[:=]\s*["']?(?!your-|example|placeholder|<)[A-Za-z0-9._~+/=-]{16,}/i
  }
];

function repositoryFiles () {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean);
}

function scanFile (file) {
  let content;
  try {
    content = readFileSync(file);
  } catch (error) {
    return [];
  }

  if (content.includes(0)) {
    return [];
  }

  const text = content.toString('utf8');
  return patterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => ({ file, name }));
}

const files = process.argv.length > 2 ? process.argv.slice(2) : repositoryFiles();
const findings = files.flatMap(scanFile);

if (findings.length > 0) {
  console.error('Potential secrets detected:');
  findings.forEach(({ file, name }) => console.error(`- ${file}: ${name}`));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed for ${files.length} file(s).`);
}
