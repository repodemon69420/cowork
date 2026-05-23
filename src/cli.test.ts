import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs, run } from './cli.js';
import type { TaskRunner } from './executor.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('./fs-adapter.js', () => ({
  readFile: vi.fn(async () => ''),
  writeFile: vi.fn(async () => {}),
}));

import { readFile } from 'node:fs/promises';
import { writeFile } from './fs-adapter.js';

const SAMPLE_TASKS_MD = `# Nightly Task Queue

---

## [ ] Build the login page
**Priority:** high
**Type:** code
**Context:** Create a responsive login form.

---

## [ ] Write API docs
**Priority:** medium
**Type:** docs
**Context:** Document the REST API endpoints.

---

## [ ] Run integration tests
**Priority:** low
**Type:** test
**Context:** Run full integration test suite.
**Depends on:** Build the login page
`;

const ALL_COMPLETED_TASKS_MD = `# Nightly Task Queue

---

## [x] Already done
**Priority:** high
**Type:** code
**Context:** This task is already completed.
`;

const CIRCULAR_TASKS_MD = `# Tasks

## [ ] Task A
**Priority:** high
**Type:** code
**Context:** Depends on B
**Depends on:** Task B

## [ ] Task B
**Priority:** high
**Type:** code
**Context:** Depends on A
**Depends on:** Task A
`;

function defaultArgs(overrides: Partial<import('./cli.js').CliArgs> = {}): import('./cli.js').CliArgs {
  return {
    tasksFile: 'TASKS.md',
    dryRun: false,
    help: false,
    version: false,
    validate: false,
    noUpdate: false,
    output: undefined,
    ...overrides,
  };
}

function createMockRunner(): TaskRunner {
  return vi.fn(async () => {});
}

describe('parseArgs', () => {
  it('returns defaults when no args provided', () => {
    const result = parseArgs([]);
    expect(result).toEqual(defaultArgs());
  });

  it('sets help flag with --help', () => {
    expect(parseArgs(['--help']).help).toBe(true);
  });

  it('sets version flag with --version', () => {
    expect(parseArgs(['--version']).version).toBe(true);
  });

  it('sets validate flag with --validate', () => {
    expect(parseArgs(['--validate']).validate).toBe(true);
  });

  it('sets dryRun flag with --dry-run', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
  });

  it('sets noUpdate flag with --no-update', () => {
    expect(parseArgs(['--no-update']).noUpdate).toBe(true);
  });

  it('sets output path with --output', () => {
    expect(parseArgs(['--output', 'report.md']).output).toBe('report.md');
  });

  it('accepts a positional tasks file path', () => {
    expect(parseArgs(['my-tasks.md']).tasksFile).toBe('my-tasks.md');
  });

  it('handles all flags combined', () => {
    const result = parseArgs(['--dry-run', '--no-update', '--output', 'out.md', 'custom.md']);
    expect(result.dryRun).toBe(true);
    expect(result.noUpdate).toBe(true);
    expect(result.output).toBe('out.md');
    expect(result.tasksFile).toBe('custom.md');
  });

  it('throws on unknown flags', () => {
    expect(() => parseArgs(['--verbose'])).toThrow('Unknown flag: --verbose');
  });

  it('throws when --output is missing its value', () => {
    expect(() => parseArgs(['--output'])).toThrow('--output requires a path');
  });

  it('throws when --output value looks like a flag', () => {
    expect(() => parseArgs(['--output', '--dry-run'])).toThrow('--output requires a path');
  });
});

describe('run', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prints help and returns exit 0', async () => {
    const output: string[] = [];
    const result = await run(defaultArgs({ help: true }), (msg) => output.push(msg));
    expect(result.exitCode).toBe(0);
    expect(output.some(l => l.includes('Usage:'))).toBe(true);
    expect(output.some(l => l.includes('--version'))).toBe(true);
    expect(output.some(l => l.includes('--validate'))).toBe(true);
    expect(output.some(l => l.includes('--no-update'))).toBe(true);
  });

  it('prints version and returns exit 0', async () => {
    const output: string[] = [];
    const result = await run(defaultArgs({ version: true }), (msg) => output.push(msg));
    expect(result.exitCode).toBe(0);
    expect(output[0]).toMatch(/^cowork v/);
  });

  it('reads tasks file and runs execution plan', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    const result = await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    expect(readFile).toHaveBeenCalledWith('TASKS.md', 'utf-8');
    expect(result.exitCode).toBe(0);
    expect(output.join('\n')).toContain('Batch 1');
  });

  it('prints dry run plan without executing', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ dryRun: true }), (msg) => output.push(msg), mockRunner);

    expect(mockRunner).not.toHaveBeenCalled();
    expect(output.join('\n')).toContain('Dry run');
  });

  it('returns exit 1 when file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(readFile).mockRejectedValue(error);
    const output: string[] = [];

    const result = await run(defaultArgs({ tasksFile: 'missing.md' }), (msg) => output.push(msg));

    expect(result.exitCode).toBe(1);
    expect(output.join('\n')).toContain('not found');
  });

  it('returns exit 1 on read errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));
    const output: string[] = [];

    const result = await run(defaultArgs(), (msg) => output.push(msg));

    expect(result.exitCode).toBe(1);
  });

  it('handles empty tasks file', async () => {
    vi.mocked(readFile).mockResolvedValue('# Just a heading\n\nNo tasks here.');
    const output: string[] = [];

    const result = await run(defaultArgs(), (msg) => output.push(msg));

    expect(result.exitCode).toBe(0);
    expect(output.join('\n')).toContain('No tasks');
  });

  it('handles all completed tasks without calling runner', async () => {
    vi.mocked(readFile).mockResolvedValue(ALL_COMPLETED_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    expect(mockRunner).not.toHaveBeenCalled();
  });
});

describe('run — validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aborts with exit 1 on validation errors', async () => {
    vi.mocked(readFile).mockResolvedValue(CIRCULAR_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    const result = await run(defaultArgs(), (msg) => output.push(msg), mockRunner);

    expect(result.exitCode).toBe(1);
    expect(mockRunner).not.toHaveBeenCalled();
    expect(output.join('\n')).toContain('ERROR');
  });

  it('--validate exits with 0 on valid tasks', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const output: string[] = [];

    const result = await run(defaultArgs({ validate: true }), (msg) => output.push(msg));

    expect(result.exitCode).toBe(0);
    expect(output.join('\n')).toContain('Validation passed');
  });

  it('--validate exits with 1 on invalid tasks', async () => {
    vi.mocked(readFile).mockResolvedValue(CIRCULAR_TASKS_MD);
    const output: string[] = [];

    const result = await run(defaultArgs({ validate: true }), (msg) => output.push(msg));

    expect(result.exitCode).toBe(1);
    expect(output.join('\n')).toContain('Validation failed');
  });
});

describe('run — pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes report to output path', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    const result = await run(
      defaultArgs({ output: 'report.md', noUpdate: true }),
      (msg) => output.push(msg),
      mockRunner,
    );

    expect(result.outputPath).toBe('report.md');
    expect(writeFile).toHaveBeenCalledWith('report.md', expect.stringContaining('Session Report'));
  });

  it('does not write report without --output', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reports failed tasks when runner throws', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const failingRunner: TaskRunner = vi.fn(async () => { throw new Error('fail'); });
    const output: string[] = [];

    const result = await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), failingRunner);

    expect(result.exitCode).toBe(0);
    expect(output.join('\n').toLowerCase()).toContain('failed');
  });

  it('prints progress output during execution', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    const joined = output.join('\n');
    expect(joined).toContain('Starting:');
    expect(joined).toContain('Completed:');
  });

  it('shows dependency ordering in batches', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    const joined = output.join('\n');
    expect(joined).toContain('Batch 2');
    expect(joined).toContain('Run integration tests');
  });

  it('updates TASKS.md after execution by default', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs(), (msg) => output.push(msg), mockRunner);

    expect(writeFile).toHaveBeenCalledWith(
      'TASKS.md',
      expect.stringContaining('[x] Build the login page'),
    );
  });

  it('skips TASKS.md update with --no-update', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const mockRunner = createMockRunner();
    const output: string[] = [];

    await run(defaultArgs({ noUpdate: true }), (msg) => output.push(msg), mockRunner);

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('marks failed tasks with [!] in TASKS.md', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);
    const failingRunner: TaskRunner = vi.fn(async () => { throw new Error('fail'); });
    const output: string[] = [];

    await run(defaultArgs(), (msg) => output.push(msg), failingRunner);

    expect(writeFile).toHaveBeenCalledWith(
      'TASKS.md',
      expect.stringContaining('[!] Build the login page'),
    );
  });
});
