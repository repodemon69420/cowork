import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type OutputFormat = 'markdown' | 'json';

export interface CoworkConfig {
  readonly tasksFile: string;
  readonly outputFormat: OutputFormat;
  readonly logDir: string;
  readonly concurrency: number;
  readonly timeout: number;
}

export const DEFAULT_CONFIG: CoworkConfig = {
  tasksFile: './TASKS.md',
  outputFormat: 'markdown',
  logDir: './.cowork/logs',
  concurrency: 4,
  timeout: 300000,
} as const;

const VALID_OUTPUT_FORMATS: readonly OutputFormat[] = ['markdown', 'json'];

function validateConfig(config: CoworkConfig): void {
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    throw new Error(
      `Invalid concurrency value: ${config.concurrency}. Must be a positive integer.`,
    );
  }

  if (typeof config.timeout !== 'number' || config.timeout <= 0) {
    throw new Error(
      `Invalid timeout value: ${config.timeout}. Must be a positive number.`,
    );
  }

  if (!VALID_OUTPUT_FORMATS.includes(config.outputFormat)) {
    throw new Error(
      `Invalid outputFormat: '${config.outputFormat}'. Must be 'markdown' or 'json'.`,
    );
  }
}

export async function loadConfig(cwd?: string): Promise<CoworkConfig> {
  const dir = cwd ?? process.cwd();
  const configPath = join(dir, 'cowork.config.json');

  let fileConfig: Partial<CoworkConfig> = {};

  try {
    const raw = await readFile(configPath, 'utf-8');
    try {
      fileConfig = JSON.parse(raw) as Partial<CoworkConfig>;
    } catch {
      throw new Error(
        `Invalid JSON in config file ${configPath}: file exists but contains malformed JSON.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }

  const merged: CoworkConfig = { ...DEFAULT_CONFIG, ...fileConfig };
  validateConfig(merged);
  return merged;
}

export function resolveConfig(
  overrides: Partial<CoworkConfig>,
  fileConfig: Partial<CoworkConfig>,
): CoworkConfig {
  const merged: CoworkConfig = { ...DEFAULT_CONFIG, ...fileConfig, ...overrides };
  validateConfig(merged);
  return merged;
}
