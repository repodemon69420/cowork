import { readFile, fileExists } from './io.js';
import type { CliOptions } from './cli.js';

export interface Config {
  tasksPath: string;
  outputPath: string;
  coverageThreshold: number;
  maxFileLines: number;
  maxFunctionLines: number;
  parallel: boolean;
}

const DEFAULT_CONFIG: Config = {
  tasksPath: './TASKS.md',
  outputPath: './MORNING_REPORT.md',
  coverageThreshold: 80,
  maxFileLines: 800,
  maxFunctionLines: 50,
  parallel: true,
};

export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

export async function loadConfig(configPath?: string): Promise<Config> {
  const path = configPath ?? '.coworkrc.json';
  const exists = await fileExists(path);
  if (!exists) {
    return getDefaultConfig();
  }
  const content = await readFile(path);
  const parsed = JSON.parse(content) as Partial<Config>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function mergeWithCliOptions(config: Config, options: CliOptions): Config {
  // CLI flags override config, but only if they differ from defaults
  // (i.e., if the user explicitly set them)
  return {
    ...config,
    tasksPath: options.tasksPath !== './TASKS.md' ? options.tasksPath : config.tasksPath,
    outputPath: options.outputPath !== './MORNING_REPORT.md' ? options.outputPath : config.outputPath,
  };
}
