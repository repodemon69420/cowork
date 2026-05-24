import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, formatPlan, main } from './cli.js';
import type { Task, ExecutionPlan } from './types.js';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('parseArgs', () => {
  it('returns defaults when no args given', () => {
    expect(parseArgs([])).toEqual({ file: 'TASKS.md', help: false, validate: false, markDone: undefined });
  });

  it('parses --file flag', () => {
    expect(parseArgs(['--file', 'custom.md'])).toEqual({ file: 'custom.md', help: false, validate: false, markDone: undefined });
  });

  it('parses --help flag', () => {
    expect(parseArgs(['--help'])).toEqual({ file: 'TASKS.md', help: true, validate: false, markDone: undefined });
  });

  it('parses -h shorthand', () => {
    expect(parseArgs(['-h'])).toEqual({ file: 'TASKS.md', help: true, validate: false, markDone: undefined });
  });

  it('parses --file and --help together', () => {
    expect(parseArgs(['--file', 'other.md', '--help'])).toEqual({ file: 'other.md', help: true, validate: false, markDone: undefined });
  });

  it('ignores --file when no value follows', () => {
    expect(parseArgs(['--file'])).toEqual({ file: 'TASKS.md', help: false, validate: false, markDone: undefined });
  });

  it('parses --mark-done flag', () => {
    expect(parseArgs(['--mark-done', 'My Task'])).toEqual({ file: 'TASKS.md', help: false, validate: false, markDone: 'My Task' });
  });

  it('parses --mark-done with --file together', () => {
    expect(parseArgs(['--file', 'todo.md', '--mark-done', 'Fix bug'])).toEqual({
      file: 'todo.md',
      help: false,
      validate: false,
      markDone: 'Fix bug',
    });
  });

  it('parses --validate flag', () => {
    expect(parseArgs(['--validate'])).toEqual({ file: 'TASKS.md', help: false, validate: true, markDone: undefined });
  });
});

describe('formatPlan', () => {
  const makeTasks = (statuses: Array<'pending' | 'completed' | 'failed'>): Task[] =>
    statuses.map((status, i) => ({
      title: `Task ${i + 1}`,
      priority: 'medium' as const,
      type: 'code' as const,
      context: '',
      status,
    }));

  it('shows correct task counts', () => {
    const tasks = makeTasks(['pending', 'completed', 'failed', 'pending']);
    const plan: ExecutionPlan = { batches: [], cycles: [] };
    const output = formatPlan(tasks, plan);
    expect(output).toContain('Total tasks: 4');
    expect(output).toContain('Pending: 2');
    expect(output).toContain('Completed: 1');
    expect(output).toContain('Failed: 1');
  });

  it('lists batches with mode and titles', () => {
    const tasks = makeTasks(['pending', 'pending']);
    const plan: ExecutionPlan = {
      batches: [{ tasks, parallel: true }],
      cycles: [],
    };
    const output = formatPlan(tasks, plan);
    expect(output).toContain('Batch 1 (parallel)');
    expect(output).toContain('Task 1');
    expect(output).toContain('Task 2');
  });

  it('shows sequential for single-task batch', () => {
    const tasks = makeTasks(['pending']);
    const plan: ExecutionPlan = {
      batches: [{ tasks, parallel: false }],
      cycles: [],
    };
    const output = formatPlan(tasks, plan);
    expect(output).toContain('Batch 1 (sequential)');
  });

  it('shows cycle warning when cycles exist', () => {
    const tasks = makeTasks(['pending']);
    const plan: ExecutionPlan = {
      batches: [],
      cycles: [['Task A', 'Task B', 'Task A']],
    };
    const output = formatPlan(tasks, plan);
    expect(output).toContain('WARNING: Dependency cycles detected');
    expect(output).toContain('Task A -> Task B -> Task A');
  });

  it('omits cycle warning when no cycles', () => {
    const tasks = makeTasks(['pending']);
    const plan: ExecutionPlan = { batches: [], cycles: [] };
    const output = formatPlan(tasks, plan);
    expect(output).not.toContain('WARNING');
  });
});

describe('main', () => {
  const originalArgv = process.argv;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let errorSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('prints plan for a valid TASKS.md', () => {
    process.argv = ['node', 'cli.js', '--file', 'TASKS.md'];
    main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total tasks:'));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints help and exits with --help', () => {
    process.argv = ['node', 'cli.js', '--help'];
    main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: cowork'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('prints error and exits 1 for missing file', () => {
    process.argv = ['node', 'cli.js', '--file', 'nonexistent-file.md'];
    main();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  describe('--mark-done', () => {
    let tmpDir: string;

    const TASK_CONTENT = [
      '# Status: ON',
      '',
      '# Nightly Task Queue',
      '',
      '---',
      '',
      '## [ ] Write tests',
      '**Priority:** high',
      '**Type:** test',
      '**Context:** unit tests',
      '',
      '---',
      '',
      '## [x] Setup CI',
      '**Priority:** medium',
      '**Type:** code',
      '**Context:** pipeline',
    ].join('\n');

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'cli-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('marks a pending task as done and updates the file', () => {
      const tmpFile = join(tmpDir, 'tasks.md');
      writeFileSync(tmpFile, TASK_CONTENT, 'utf-8');
      process.argv = ['node', 'cli.js', '--file', tmpFile, '--mark-done', 'Write tests'];
      main();
      expect(logSpy).toHaveBeenCalledWith('Marked done: Write tests');
      const updated = readFileSync(tmpFile, 'utf-8');
      expect(updated).toContain('[x] Write tests');
    });

    it('exits 1 for a non-existent task', () => {
      const tmpFile = join(tmpDir, 'tasks.md');
      writeFileSync(tmpFile, TASK_CONTENT, 'utf-8');
      process.argv = ['node', 'cli.js', '--file', tmpFile, '--mark-done', 'No such task'];
      main();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits 1 for an already completed task', () => {
      const tmpFile = join(tmpDir, 'tasks.md');
      writeFileSync(tmpFile, TASK_CONTENT, 'utf-8');
      process.argv = ['node', 'cli.js', '--file', tmpFile, '--mark-done', 'Setup CI'];
      main();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already completed'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('--validate', () => {
    let tmpDir: string;

    const VALID_TASKS = [
      '# Status: ON',
      '',
      '# Tasks',
      '',
      '---',
      '',
      '## [ ] Build feature',
      '**Priority:** high',
      '**Type:** code',
      '**Context:** implement it',
      '',
      '---',
    ].join('\n');

    const DUPLICATE_TASKS = [
      '# Status: ON',
      '',
      '# Tasks',
      '',
      '---',
      '',
      '## [ ] Build feature',
      '**Priority:** high',
      '**Type:** code',
      '**Context:** implement it',
      '',
      '---',
      '',
      '## [ ] Build feature',
      '**Priority:** medium',
      '**Type:** code',
      '**Context:** duplicate',
      '',
      '---',
    ].join('\n');

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'cli-validate-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('prints PASS for a valid tasks file', () => {
      const tmpFile = join(tmpDir, 'tasks.md');
      writeFileSync(tmpFile, VALID_TASKS, 'utf-8');
      process.argv = ['node', 'cli.js', '--file', tmpFile, '--validate'];
      main();
      expect(logSpy).toHaveBeenCalledWith('Validation: PASS');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('prints FAIL and exits 1 for duplicate tasks', () => {
      const tmpFile = join(tmpDir, 'tasks.md');
      writeFileSync(tmpFile, DUPLICATE_TASKS, 'utf-8');
      process.argv = ['node', 'cli.js', '--file', tmpFile, '--validate'];
      main();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Validation: FAIL'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
