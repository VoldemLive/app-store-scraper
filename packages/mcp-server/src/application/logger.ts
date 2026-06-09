import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.js';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LEVELS[number];

export type LogEvent = {
  level: LogLevel;
  operation: string;
  requestId: string;
  durationMs?: number;
  outcome?: 'success' | 'error';
  code?: string;
};

export type Logger = {
  log: (event: LogEvent) => void;
};

export function requestId (value: string | number): string {
  const id = String(value);
  return id.length > 0 ? id : randomUUID();
}

export function createStderrLogger (
  config: ServerConfig,
  write: (message: string) => void = message => process.stderr.write(message)
): Logger {
  const minimum = LEVELS.indexOf(config.logLevel);

  return {
    log: event => {
      if (LEVELS.indexOf(event.level) < minimum) return;
      write(`${JSON.stringify(event)}\n`);
    }
  };
}
