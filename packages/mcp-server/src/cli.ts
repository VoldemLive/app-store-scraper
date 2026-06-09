#!/usr/bin/env node

import { startStdioServer, type StdioServerRuntime } from './stdio.js';

function writeDiagnostic (message: string): void {
  process.stderr.write(`${message}\n`);
}

function installShutdownHandlers (runtime: StdioServerRuntime): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    writeDiagnostic(`MCP server shutting down after ${signal}.`);

    try {
      await runtime.close();
      process.exitCode = 0;
    } catch {
      writeDiagnostic('MCP server shutdown failed.');
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

try {
  const runtime = await startStdioServer();
  installShutdownHandlers(runtime);
} catch {
  writeDiagnostic('MCP server startup failed.');
  process.exitCode = 1;
}
