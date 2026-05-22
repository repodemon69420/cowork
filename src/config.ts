import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Config {
  tasksFile: string;
  reportFile: string;
  statusLine: string;
}

const VALID_KEYS: ReadonlySet<string> = new Set<keyof Config>([
  'tasksFile',
  'reportFile',
  'statusLine',
]);

export const DEFAULT_CONFIG: Config = {
  tasksFile: 'TASKS.md',
  reportFile: 'MORNING_REPORT.md',
  statusLine: '# Status: ON',
};

export function mergeConfig(partial: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...partial };
}

export function loadConfig(cwd?: string): Config {
  const dir = cwd ?? process.cwd();
  const filePath = join(dir, '.coworkrc.json');

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return { ...DEFAULT_CONFIG };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid JSON in ${filePath}`);
  }

  const filtered: Partial<Config> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (VALID_KEYS.has(key)) {
      filtered[key as keyof Config] = value as string;
    }
  }

  return mergeConfig(filtered);
}
