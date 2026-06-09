#!/usr/bin/env node

import { startStdioServer, type StdioServerRuntime } from './stdio.js';

const CLOSE_TIMEOUT_MS = 5000;

function writeDiagnostic (message: string): void {
  process.stderr.write(`${message}\n`);
}

let serverRuntime: StdioServerRuntime | null = null;

function handleSignal (signal: string): void {
  writeDiagnostic(`MCP server shutting down after ${signal}.`);
  if (serverRuntime !== null) {
    const closeWithTimeout = Promise.race([
      serverRuntime.close(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('close timeout')), CLOSE_TIMEOUT_MS).unref()
      )
    ]);
    closeWithTimeout
      .then(() => process.exit(0))
      .catch(() => {
        writeDiagnostic('MCP server shutdown failed.');
        process.exit(1);
      });
  } else {
    process.exit(0);
  }
}

process.once('SIGINT', () => handleSignal('SIGINT'));
process.once('SIGTERM', () => handleSignal('SIGTERM'));

try {
  serverRuntime = await startStdioServer();
} catch {
  writeDiagnostic('MCP server startup failed.');
  process.exit(1);
}
