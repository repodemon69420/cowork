import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export interface LoggerOptions {
  filePath?: string;
  level?: LogLevel;
  write?: (entry: LogEntry) => void;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const LOG_LEVEL_ORDER: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'] as const;

function getLevelIndex(level: LogLevel): number {
  return LOG_LEVEL_ORDER.indexOf(level);
}

function createFileWriter(filePath: string): (entry: LogEntry) => void {
  return (entry: LogEntry) => {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
  };
}

export function createLogger(options?: LoggerOptions): Logger {
  const filePath = options?.filePath ?? 'logs/cowork.log';
  const minLevel = options?.level ?? 'info';
  const writer = options?.write ?? createFileWriter(filePath);
  const minLevelIndex = getLevelIndex(minLevel);

  function log(level: LogLevel, message: string, data?: unknown): void {
    if (getLevelIndex(level) < minLevelIndex) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    writer(entry);
  }

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
}
