import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDefaultConfig, loadConfig, mergeWithCliOptions } from './config.js';
import type { Config } from './config.js';
import type { CliOptions } from './cli.js';

describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getDefaultConfig', () => {
    it('returns expected defaults', () => {
      const config = getDefaultConfig();
      expect(config).toEqual({
        tasksPath: './TASKS.md',
        outputPath: './MORNING_REPORT.md',
        coverageThreshold: 80,
        maxFileLines: 800,
        maxFunctionLines: 50,
        parallel: true,
      });
    });

    it('returns a fresh copy (not shared reference)', () => {
      const a = getDefaultConfig();
      const b = getDefaultConfig();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      a.coverageThreshold = 0;
      expect(b.coverageThreshold).toBe(80);
    });
  });

  describe('loadConfig', () => {
    it('returns defaults when no config file exists', async () => {
      const configPath = join(tempDir, '.coworkrc.json');
      const config = await loadConfig(configPath);
      expect(config).toEqual(getDefaultConfig());
    });

    it('merges a valid config file with defaults', async () => {
      const configPath = join(tempDir, '.coworkrc.json');
      await fsWriteFile(configPath, JSON.stringify({
        tasksPath: './custom-tasks.md',
        outputPath: './custom-report.md',
        coverageThreshold: 90,
        maxFileLines: 500,
        maxFunctionLines: 30,
        parallel: false,
      }), 'utf-8');

      const config = await loadConfig(configPath);
      expect(config).toEqual({
        tasksPath: './custom-tasks.md',
        outputPath: './custom-report.md',
        coverageThreshold: 90,
        maxFileLines: 500,
        maxFunctionLines: 30,
        parallel: false,
      });
    });

    it('uses defaults for missing fields in a partial config', async () => {
      const configPath = join(tempDir, '.coworkrc.json');
      await fsWriteFile(configPath, JSON.stringify({
        coverageThreshold: 95,
      }), 'utf-8');

      const config = await loadConfig(configPath);
      expect(config.coverageThreshold).toBe(95);
      expect(config.tasksPath).toBe('./TASKS.md');
      expect(config.outputPath).toBe('./MORNING_REPORT.md');
      expect(config.maxFileLines).toBe(800);
      expect(config.maxFunctionLines).toBe(50);
      expect(config.parallel).toBe(true);
    });

    it('loads from an explicit path', async () => {
      const configPath = join(tempDir, 'my-custom-config.json');
      await fsWriteFile(configPath, JSON.stringify({
        parallel: false,
        maxFileLines: 1000,
      }), 'utf-8');

      const config = await loadConfig(configPath);
      expect(config.parallel).toBe(false);
      expect(config.maxFileLines).toBe(1000);
      expect(config.tasksPath).toBe('./TASKS.md');
    });

    it('throws on invalid JSON', async () => {
      const configPath = join(tempDir, '.coworkrc.json');
      await fsWriteFile(configPath, '{ not valid json !!!', 'utf-8');

      await expect(loadConfig(configPath)).rejects.toThrow();
    });
  });

  describe('mergeWithCliOptions', () => {
    const defaultCliOptions: CliOptions = {
      tasksPath: './TASKS.md',
      outputPath: './MORNING_REPORT.md',
      dryRun: false,
      validate: false,
      help: false,
      quiet: false,
    };

    it('CLI flags override config when they differ from defaults', () => {
      const config: Config = {
        tasksPath: './config-tasks.md',
        outputPath: './config-report.md',
        coverageThreshold: 90,
        maxFileLines: 500,
        maxFunctionLines: 30,
        parallel: false,
      };

      const options: CliOptions = {
        ...defaultCliOptions,
        tasksPath: './cli-tasks.md',
        outputPath: './cli-report.md',
      };

      const merged = mergeWithCliOptions(config, options);
      expect(merged.tasksPath).toBe('./cli-tasks.md');
      expect(merged.outputPath).toBe('./cli-report.md');
      // Non-CLI fields are preserved from config
      expect(merged.coverageThreshold).toBe(90);
      expect(merged.maxFileLines).toBe(500);
      expect(merged.parallel).toBe(false);
    });

    it('default CLI values do not override config', () => {
      const config: Config = {
        tasksPath: './config-tasks.md',
        outputPath: './config-report.md',
        coverageThreshold: 90,
        maxFileLines: 500,
        maxFunctionLines: 30,
        parallel: false,
      };

      const merged = mergeWithCliOptions(config, defaultCliOptions);
      expect(merged.tasksPath).toBe('./config-tasks.md');
      expect(merged.outputPath).toBe('./config-report.md');
      expect(merged.coverageThreshold).toBe(90);
    });
  });
});
