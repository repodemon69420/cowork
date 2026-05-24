import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseConfig, readConfig, loadConfig } from './config.js';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const VALID_CONFIG = {
  repo: {
    owner: 'repodemon69420',
    name: 'cowork',
    url: 'https://github.com/repodemon69420/cowork',
    localPath: '~/projects/cowork',
  },
  orchestrator: {
    triggerId: 'cowork-orchestrator',
    taskFile: 'TASKS.md',
    outputFile: 'MORNING_REPORT.md',
  },
  phone: {
    toggleIssueNumber: 1,
    toggleIssueTitle: 'DEV TEAM ON/OFF SWITCH',
  },
};

describe('config', () => {
  describe('parseConfig', () => {
    it('parses valid JSON', () => {
      const result = parseConfig(JSON.stringify(VALID_CONFIG));
      expect(result.repo.owner).toBe('repodemon69420');
      expect(result.orchestrator.triggerId).toBe('cowork-orchestrator');
      expect(result.phone.toggleIssueNumber).toBe(1);
    });

    it('throws for missing repo field', () => {
      const cfg = { ...VALID_CONFIG, repo: undefined };
      expect(() => parseConfig(JSON.stringify(cfg))).toThrow('Missing required config section: repo');
    });

    it('throws for missing orchestrator field', () => {
      const cfg = { ...VALID_CONFIG, orchestrator: undefined };
      expect(() => parseConfig(JSON.stringify(cfg))).toThrow('Missing required config section: orchestrator');
    });

    it('throws for missing phone field', () => {
      const cfg = { ...VALID_CONFIG, phone: undefined };
      expect(() => parseConfig(JSON.stringify(cfg))).toThrow('Missing required config section: phone');
    });

    it('throws for invalid JSON', () => {
      expect(() => parseConfig('not json {')).toThrow('Invalid JSON in config file');
    });
  });

  describe('readConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `cowork-cfg-test-${randomUUID()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('reads and parses a config file', () => {
      const filePath = join(tempDir, 'config.json');
      writeFileSync(filePath, JSON.stringify(VALID_CONFIG), 'utf-8');
      const result = readConfig(filePath);
      expect(result.repo.name).toBe('cowork');
      expect(result.orchestrator.taskFile).toBe('TASKS.md');
      expect(result.phone.toggleIssueTitle).toBe('DEV TEAM ON/OFF SWITCH');
    });
  });

  describe('loadConfig', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();
      tempDir = join(tmpdir(), `cowork-load-test-${randomUUID()}`);
      mkdirSync(join(tempDir, '.claude'), { recursive: true });
    });

    afterEach(() => {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('finds config in cwd', () => {
      const configPath = join(tempDir, '.claude', 'cowork-config.json');
      writeFileSync(configPath, JSON.stringify(VALID_CONFIG), 'utf-8');
      process.chdir(tempDir);
      const result = loadConfig();
      expect(result.repo.url).toBe('https://github.com/repodemon69420/cowork');
      expect(result.orchestrator.outputFile).toBe('MORNING_REPORT.md');
    });
  });
});
