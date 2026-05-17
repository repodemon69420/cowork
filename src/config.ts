import { existsSync, readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

export interface Config {
  tasksFile: string;
  logFile: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  coverageThreshold: number;
  maxFileLines: number;
  maxFunctionLines: number;
}

export const DEFAULT_CONFIG: Config = {
  tasksFile: 'TASKS.md',
  logFile: 'logs/cowork.log',
  logLevel: 'info',
  coverageThreshold: 80,
  maxFileLines: 800,
  maxFunctionLines: 50,
};

const KNOWN_KEYS: ReadonlySet<string> = new Set([
  'tasksFile',
  'logFile',
  'logLevel',
  'coverageThreshold',
  'maxFileLines',
  'maxFunctionLines',
]);

const NUMERIC_KEYS: ReadonlySet<string> = new Set([
  'coverageThreshold',
  'maxFileLines',
  'maxFunctionLines',
]);

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set([
  'debug',
  'info',
  'warn',
  'error',
]);

/**
 * Loads configuration from a .coworkrc.json file in the given directory,
 * falling back to sensible defaults for any missing values.
 */
export function loadConfig(cwd?: string): Config {
  const dir = cwd ?? process.cwd();
  const configPath = resolve(dir, '.coworkrc.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Invalid JSON in ${configPath}: failed to parse .coworkrc.json`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Invalid JSON in ${configPath}: expected an object`
    );
  }

  const fileConfig = parsed as Record<string, unknown>;
  const overrides: Partial<Config> = {};

  for (const key of Object.keys(fileConfig)) {
    if (!KNOWN_KEYS.has(key)) {
      continue;
    }

    const value = fileConfig[key];

    if (NUMERIC_KEYS.has(key)) {
      if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
        throw new Error(
          `Invalid config: "${key}" must be a positive number, got: ${JSON.stringify(value)}`
        );
      }
      (overrides as Record<string, unknown>)[key] = value;
    } else if (key === 'logLevel') {
      if (typeof value !== 'string' || !VALID_LOG_LEVELS.has(value)) {
        throw new Error(
          `Invalid config: "logLevel" must be one of ${[...VALID_LOG_LEVELS].join(', ')}, got: ${JSON.stringify(value)}`
        );
      }
      overrides.logLevel = value as Config['logLevel'];
    } else {
      if (typeof value !== 'string') {
        throw new Error(
          `Invalid config: "${key}" must be a string, got: ${JSON.stringify(value)}`
        );
      }
      (overrides as Record<string, unknown>)[key] = value;
    }
  }

  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Resolves relative paths (tasksFile, logFile) against the given cwd.
 * Returns a new Config object without mutating the original.
 */
export function resolveConfigPaths(config: Config, cwd: string): Config {
  return {
    ...config,
    tasksFile: isAbsolute(config.tasksFile)
      ? config.tasksFile
      : resolve(cwd, config.tasksFile),
    logFile: isAbsolute(config.logFile)
      ? config.logFile
      : resolve(cwd, config.logFile),
  };
}
