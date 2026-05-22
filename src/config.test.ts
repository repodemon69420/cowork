import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig, loadConfig } from './config.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'node:fs';

const mockedReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('DEFAULT_CONFIG', () => {
  it('has correct default values', () => {
    expect(DEFAULT_CONFIG.tasksFile).toBe('TASKS.md');
    expect(DEFAULT_CONFIG.reportFile).toBe('MORNING_REPORT.md');
    expect(DEFAULT_CONFIG.statusLine).toBe('# Status: ON');
  });
});

describe('mergeConfig', () => {
  it('returns defaults when given an empty partial', () => {
    const result = mergeConfig({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('overrides some values while keeping other defaults', () => {
    const result = mergeConfig({ tasksFile: 'MY_TASKS.md' });
    expect(result.tasksFile).toBe('MY_TASKS.md');
    expect(result.reportFile).toBe('MORNING_REPORT.md');
    expect(result.statusLine).toBe('# Status: ON');
  });

  it('overrides all values', () => {
    const result = mergeConfig({
      tasksFile: 'custom-tasks.md',
      reportFile: 'custom-report.md',
      statusLine: '# Status: OFF',
    });
    expect(result).toEqual({
      tasksFile: 'custom-tasks.md',
      reportFile: 'custom-report.md',
      statusLine: '# Status: OFF',
    });
  });

  it('does not mutate DEFAULT_CONFIG', () => {
    const before = { ...DEFAULT_CONFIG };
    mergeConfig({ tasksFile: 'changed.md' });
    expect(DEFAULT_CONFIG).toEqual(before);
  });
});

describe('loadConfig', () => {
  it('returns defaults when .coworkrc.json does not exist', () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    const result = loadConfig('/some/dir');
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('reads and merges .coworkrc.json', () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ tasksFile: 'override.md' }),
    );
    const result = loadConfig('/some/dir');
    expect(result.tasksFile).toBe('override.md');
    expect(result.reportFile).toBe('MORNING_REPORT.md');
    expect(result.statusLine).toBe('# Status: ON');
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      '/some/dir/.coworkrc.json',
      'utf-8',
    );
  });

  it('throws on invalid JSON', () => {
    mockedReadFileSync.mockReturnValue('{ not valid json');
    expect(() => loadConfig('/some/dir')).toThrow('Invalid JSON');
  });

  it('ignores unknown keys in the file', () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        tasksFile: 'custom.md',
        unknownKey: 'should be ignored',
        anotherUnknown: 42,
      }),
    );
    const result = loadConfig('/some/dir');
    expect(result.tasksFile).toBe('custom.md');
    expect(result.reportFile).toBe('MORNING_REPORT.md');
    expect(result).toEqual({
      tasksFile: 'custom.md',
      reportFile: 'MORNING_REPORT.md',
      statusLine: '# Status: ON',
    });
    expect(result).not.toHaveProperty('unknownKey');
    expect(result).not.toHaveProperty('anotherUnknown');
  });

  it('uses process.cwd() when no directory is provided', () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    loadConfig();
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.coworkrc.json'),
      'utf-8',
    );
  });
});
