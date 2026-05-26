export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level: LogLevel;
  quiet?: boolean;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(options: LoggerOptions): Logger {
  const minLevel = LEVEL_ORDER[options.level];
  const quiet = options.quiet ?? false;

  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (quiet && level !== 'error') return;
    if (LEVEL_ORDER[level] < minLevel) return;

    const tag = `[${level.toUpperCase()}]`;
    const line = data ? `${tag} ${message} ${JSON.stringify(data)}` : `${tag} ${message}`;

    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
  };
}
