import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadConfig, resolveConfigPaths, DEFAULT_CONFIG, Config } from './config.js';

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cowork-config-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no .coworkrc.json exists', () => {
    const config = loadConfig(tempDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('loads file and merges with defaults', () => {
    const rcContent: Partial<Config> = {
      tasksFile: 'MY_TASKS.md',
      logLevel: 'debug',
      coverageThreshold: 90,
    };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    const config = loadConfig(tempDir);
    expect(config).toEqual({
      tasksFile: 'MY_TASKS.md',
      logFile: 'logs/cowork.log',
      logLevel: 'debug',
      coverageThreshold: 90,
      maxFileLines: 800,
      maxFunctionLines: 50,
    });
  });

  it('handles partial config — only overrides specified keys', () => {
    const rcContent = { maxFileLines: 500 };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    const config = loadConfig(tempDir);
    expect(config.maxFileLines).toBe(500);
    expect(config.tasksFile).toBe('TASKS.md');
    expect(config.logFile).toBe('logs/cowork.log');
    expect(config.logLevel).toBe('info');
    expect(config.coverageThreshold).toBe(80);
    expect(config.maxFunctionLines).toBe(50);
  });

  it('throws a clear error on invalid JSON', () => {
    writeFileSync(join(tempDir, '.coworkrc.json'), '{ invalid json!!!');

    expect(() => loadConfig(tempDir)).toThrow(/invalid.*json/i);
  });

  it('ignores unknown keys silently', () => {
    const rcContent = {
      tasksFile: 'custom.md',
      unknownKey: 'should be ignored',
      anotherUnknown: 42,
    };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    const config = loadConfig(tempDir);
    expect(config.tasksFile).toBe('custom.md');
    expect((config as unknown as Record<string, unknown>)['unknownKey']).toBeUndefined();
    expect((config as unknown as Record<string, unknown>)['anotherUnknown']).toBeUndefined();
  });

  it('validates that numeric values are positive numbers', () => {
    const rcContent = { coverageThreshold: -5 };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    expect(() => loadConfig(tempDir)).toThrow(/positive/i);
  });

  it('validates that numeric values are actually numbers', () => {
    const rcContent = { maxFileLines: 'not a number' };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    expect(() => loadConfig(tempDir)).toThrow(/positive/i);
  });

  it('validates logLevel is a valid value', () => {
    const rcContent = { logLevel: 'verbose' };
    writeFileSync(join(tempDir, '.coworkrc.json'), JSON.stringify(rcContent));

    expect(() => loadConfig(tempDir)).toThrow(/logLevel/i);
  });

  it('uses process.cwd() when no cwd argument is provided', () => {
    // This just verifies it doesn't throw when called without arguments
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.tasksFile).toBe(DEFAULT_CONFIG.tasksFile);
  });
});

describe('resolveConfigPaths', () => {
  it('resolves relative paths against the given cwd', () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      tasksFile: 'TASKS.md',
      logFile: 'logs/cowork.log',
    };

    const resolved = resolveConfigPaths(config, '/home/user/project');
    expect(resolved.tasksFile).toBe(resolve('/home/user/project', 'TASKS.md'));
    expect(resolved.logFile).toBe(resolve('/home/user/project', 'logs/cowork.log'));
  });

  it('preserves absolute paths unchanged', () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      tasksFile: '/absolute/path/TASKS.md',
      logFile: '/var/log/cowork.log',
    };

    const resolved = resolveConfigPaths(config, '/home/user/project');
    expect(resolved.tasksFile).toBe('/absolute/path/TASKS.md');
    expect(resolved.logFile).toBe('/var/log/cowork.log');
  });

  it('does not mutate the original config', () => {
    const config: Config = { ...DEFAULT_CONFIG };
    const resolved = resolveConfigPaths(config, '/home/user/project');

    expect(resolved).not.toBe(config);
    expect(config.tasksFile).toBe('TASKS.md');
  });
});
