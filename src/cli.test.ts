import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, formatPlan, main } from './cli.js';
import type { Task, ExecutionPlan } from './types.js';

describe('parseArgs', () => {
  it('returns defaults when no args given', () => {
    expect(parseArgs([])).toEqual({ file: 'TASKS.md', help: false });
  });

  it('parses --file flag', () => {
    expect(parseArgs(['--file', 'custom.md'])).toEqual({ file: 'custom.md', help: false });
  });

  it('parses --help flag', () => {
    expect(parseArgs(['--help'])).toEqual({ file: 'TASKS.md', help: true });
  });

  it('parses -h shorthand', () => {
    expect(parseArgs(['-h'])).toEqual({ file: 'TASKS.md', help: true });
  });

  it('parses --file and --help together', () => {
    expect(parseArgs(['--file', 'other.md', '--help'])).toEqual({ file: 'other.md', help: true });
  });

  it('ignores --file when no value follows', () => {
    expect(parseArgs(['--file'])).toEqual({ file: 'TASKS.md', help: false });
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
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

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
});
