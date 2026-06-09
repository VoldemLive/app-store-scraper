#!/usr/bin/env node

import { startStdioServer, type StdioServerRuntime } from './stdio.js';

function writeDiagnostic (message: string): void {
  process.stderr.write(`${message}\n`);
}

let serverRuntime: StdioServerRuntime | null = null;

function handleSignal (signal: string): void {
  writeDiagnostic(`MCP server shutting down after ${signal}.`);
  if (serverRuntime !== null) {
    serverRuntime.close()
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
  process.exitCode = 1;
}
