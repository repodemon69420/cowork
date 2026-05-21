import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, resolveConfig, DEFAULT_CONFIG } from './config.js';
import type { CoworkConfig } from './config.js';

const TEST_DIR = join(import.meta.dirname, '__test_config_tmp__');

async function writeConfigFile(
  dir: string,
  content: string,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'cowork.config.json'), content, 'utf-8');
}

describe('loadConfig', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', async () => {
    const config = await loadConfig(TEST_DIR);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('returns a new object each time (not the same reference)', async () => {
    const a = await loadConfig(TEST_DIR);
    const b = await loadConfig(TEST_DIR);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('merges a partial config with defaults', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ concurrency: 8 }));
    const config = await loadConfig(TEST_DIR);
    expect(config.concurrency).toBe(8);
    expect(config.tasksFile).toBe(DEFAULT_CONFIG.tasksFile);
    expect(config.outputFormat).toBe(DEFAULT_CONFIG.outputFormat);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
    expect(config.timeout).toBe(DEFAULT_CONFIG.timeout);
  });

  it('throws a descriptive error for invalid JSON', async () => {
    await writeConfigFile(TEST_DIR, '{ not valid json!!!');
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid JSON/);
  });

  it('throws for negative concurrency', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ concurrency: -1 }));
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid concurrency/);
  });

  it('throws for zero timeout', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ timeout: 0 }));
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid timeout/);
  });

  it('throws for invalid outputFormat', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ outputFormat: 'xml' }));
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid outputFormat/);
  });

  it('returns defaults for an empty object in config file', async () => {
    await writeConfigFile(TEST_DIR, '{}');
    const config = await loadConfig(TEST_DIR);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('overrides all defaults when full config is provided', async () => {
    const full: CoworkConfig = {
      tasksFile: './custom/TASKS.md',
      outputFormat: 'json',
      logDir: './logs',
      concurrency: 2,
      timeout: 60000,
    };
    await writeConfigFile(TEST_DIR, JSON.stringify(full));
    const config = await loadConfig(TEST_DIR);
    expect(config).toEqual(full);
  });

  it('throws for non-integer concurrency (float)', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ concurrency: 2.5 }));
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid concurrency/);
  });

  it('throws for negative timeout', async () => {
    await writeConfigFile(TEST_DIR, JSON.stringify({ timeout: -100 }));
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(/Invalid timeout/);
  });
});

describe('resolveConfig', () => {
  it('returns defaults when no overrides or file config provided', () => {
    const config = resolveConfig({}, {});
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('uses file config when no overrides provided', () => {
    const fileConfig: Partial<CoworkConfig> = {
      concurrency: 16,
      outputFormat: 'json',
    };
    const config = resolveConfig({}, fileConfig);
    expect(config.concurrency).toBe(16);
    expect(config.outputFormat).toBe('json');
    expect(config.tasksFile).toBe(DEFAULT_CONFIG.tasksFile);
  });

  it('CLI overrides take precedence over file config', () => {
    const fileConfig: Partial<CoworkConfig> = {
      concurrency: 16,
      timeout: 60000,
    };
    const overrides: Partial<CoworkConfig> = {
      concurrency: 1,
    };
    const config = resolveConfig(overrides, fileConfig);
    expect(config.concurrency).toBe(1);
    expect(config.timeout).toBe(60000);
  });

  it('CLI overrides take precedence over both file config and defaults', () => {
    const fileConfig: Partial<CoworkConfig> = {
      outputFormat: 'json',
    };
    const overrides: Partial<CoworkConfig> = {
      outputFormat: 'markdown',
      concurrency: 10,
    };
    const config = resolveConfig(overrides, fileConfig);
    expect(config.outputFormat).toBe('markdown');
    expect(config.concurrency).toBe(10);
  });

  it('validates the merged result', () => {
    expect(() =>
      resolveConfig({ concurrency: -5 }, {}),
    ).toThrow(/Invalid concurrency/);
  });
});

describe('resolveConfig CLI integration patterns', () => {
  it('--file flag maps to tasksFile and overrides config', () => {
    const fileConfig: Partial<CoworkConfig> = { tasksFile: './config-tasks.md' };
    const cliOverrides: Partial<CoworkConfig> = { tasksFile: './cli-tasks.md' };
    const config = resolveConfig(cliOverrides, fileConfig);
    expect(config.tasksFile).toBe('./cli-tasks.md');
  });

  it('--format flag maps to outputFormat and overrides config', () => {
    const fileConfig: Partial<CoworkConfig> = { outputFormat: 'markdown' };
    const cliOverrides: Partial<CoworkConfig> = { outputFormat: 'json' };
    const config = resolveConfig(cliOverrides, fileConfig);
    expect(config.outputFormat).toBe('json');
  });

  it('--log-dir flag maps to logDir and overrides config', () => {
    const fileConfig: Partial<CoworkConfig> = { logDir: './config-logs' };
    const cliOverrides: Partial<CoworkConfig> = { logDir: './cli-logs' };
    const config = resolveConfig(cliOverrides, fileConfig);
    expect(config.logDir).toBe('./cli-logs');
  });

  it('missing config file yields defaults so CLI works without config', () => {
    const config = resolveConfig({}, {});
    expect(config.tasksFile).toBe('./TASKS.md');
    expect(config.outputFormat).toBe('markdown');
    expect(config.logDir).toBe('./.cowork/logs');
    expect(config.concurrency).toBe(4);
    expect(config.timeout).toBe(300000);
  });

  it('config file values flow through when no CLI flags override them', () => {
    const fileConfig: Partial<CoworkConfig> = {
      tasksFile: './custom/TASKS.md',
      outputFormat: 'json',
      logDir: './custom-logs',
      concurrency: 8,
      timeout: 60000,
    };
    const config = resolveConfig({}, fileConfig);
    expect(config.tasksFile).toBe('./custom/TASKS.md');
    expect(config.outputFormat).toBe('json');
    expect(config.logDir).toBe('./custom-logs');
    expect(config.concurrency).toBe(8);
    expect(config.timeout).toBe(60000);
  });

  it('partial CLI overrides merge correctly with partial file config', () => {
    const fileConfig: Partial<CoworkConfig> = {
      tasksFile: './file-tasks.md',
      concurrency: 16,
    };
    const cliOverrides: Partial<CoworkConfig> = {
      tasksFile: './override-tasks.md',
    };
    const config = resolveConfig(cliOverrides, fileConfig);
    expect(config.tasksFile).toBe('./override-tasks.md');
    expect(config.concurrency).toBe(16);
    expect(config.outputFormat).toBe(DEFAULT_CONFIG.outputFormat);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
    expect(config.timeout).toBe(DEFAULT_CONFIG.timeout);
  });
});
