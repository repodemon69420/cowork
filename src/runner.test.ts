import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CoworkConfig } from './config.js';
import type { Task } from './types.js';
import { runIteration, runFromFile } from './runner.js';

const mockConfig: CoworkConfig = {
  repo: { owner: 'test', name: 'test', url: 'http://test', localPath: '/tmp' },
  orchestrator: { triggerId: 'test', taskFile: 'TASKS.md', outputFile: 'REPORT.md' },
  phone: { toggleIssueNumber: 1, toggleIssueTitle: 'Switch' },
};

const sampleTask: Task = {
  title: 'Sample task',
  priority: 'high',
  type: 'code',
  context: 'do something',
  status: 'pending',
};

let consoleSpy: { log: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };

beforeEach(() => {
  consoleSpy = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
});

afterEach(() => {
  consoleSpy.log.mockRestore();
  consoleSpy.warn.mockRestore();
  consoleSpy.error.mockRestore();
});

describe('runIteration', () => {
  it('dry-run returns correct final state (idle, iteration incremented)', () => {
    const result = runIteration(mockConfig, [sampleTask], { dryRun: true, iteration: 3 });
    expect(result.context.state).toBe('idle');
    expect(result.context.iteration).toBe(4);
  });

  it('logs contain "Starting iteration"', () => {
    const result = runIteration(mockConfig, [sampleTask], { dryRun: true, iteration: 5 });
    expect(result.log.some(l => l.includes('Starting iteration 5'))).toBe(true);
  });

  it('logs contain "Dry run" when dryRun=true', () => {
    const result = runIteration(mockConfig, [sampleTask], { dryRun: true });
    expect(result.log.some(l => l.includes('Dry run'))).toBe(true);
  });

  it('logs contain "Execution would happen here" when dryRun=false', () => {
    const result = runIteration(mockConfig, [sampleTask], { dryRun: false });
    expect(result.log.some(l => l.includes('Execution would happen here'))).toBe(true);
  });

  it('handles empty task list', () => {
    const result = runIteration(mockConfig, [], { dryRun: true });
    expect(result.context.state).toBe('idle');
    expect(result.context.plan).not.toBeNull();
    expect(result.context.plan!.batches).toHaveLength(0);
  });

  it('handles tasks with validation errors (errors in context)', () => {
    const dup: Task = { ...sampleTask };
    const result = runIteration(mockConfig, [sampleTask, dup], { dryRun: true });
    expect(result.context.errors.length).toBeGreaterThan(0);
    expect(result.context.state).toBe('idle');
  });
});

describe('runFromFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'runner-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads and parses a real file', () => {
    const taskFile = join(tmpDir, 'TASKS.md');
    writeFileSync(taskFile, [
      '## [ ] Build login page',
      '- **Priority:** high',
      '- **Type:** code',
      '- **Context:** Create the login page',
    ].join('\n'), 'utf-8');

    const result = runFromFile(mockConfig, taskFile, { dryRun: true });
    expect(result.context.state).toBe('idle');
    expect(result.context.plan!.batches.length).toBeGreaterThan(0);
  });

  it('throws for missing file', () => {
    expect(() => runFromFile(mockConfig, '/nonexistent/TASKS.md', { dryRun: true })).toThrow();
  });
});
