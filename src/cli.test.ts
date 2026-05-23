import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs, run } from './cli.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';

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

describe('parseArgs', () => {
  it('returns defaults when no args provided', () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      tasksFile: 'TASKS.md',
      dryRun: false,
      help: false,
      output: undefined,
    });
  });

  it('sets help flag with --help', () => {
    const result = parseArgs(['--help']);
    expect(result.help).toBe(true);
  });

  it('sets dryRun flag with --dry-run', () => {
    const result = parseArgs(['--dry-run']);
    expect(result.dryRun).toBe(true);
  });

  it('sets output path with --output', () => {
    const result = parseArgs(['--output', 'report.md']);
    expect(result.output).toBe('report.md');
  });

  it('accepts a positional tasks file path', () => {
    const result = parseArgs(['my-tasks.md']);
    expect(result.tasksFile).toBe('my-tasks.md');
  });

  it('handles all flags combined', () => {
    const result = parseArgs(['--dry-run', '--output', 'out.md', 'custom.md']);
    expect(result.dryRun).toBe(true);
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

  it('prints help message and returns when help flag is set', async () => {
    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: true, output: undefined },
      (msg: string) => output.push(msg),
    );
    expect(result.exitCode).toBe(0);
    expect(output.some(line => line.includes('Usage:'))).toBe(true);
    expect(output.some(line => line.includes('--help'))).toBe(true);
    expect(output.some(line => line.includes('--dry-run'))).toBe(true);
    expect(output.some(line => line.includes('--output'))).toBe(true);
  });

  it('reads the tasks file, parses, and prints execution plan', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    expect(readFile).toHaveBeenCalledWith('TASKS.md', 'utf-8');
    expect(result.exitCode).toBe(0);

    const joined = output.join('\n');
    expect(joined).toContain('Batch 1');
    expect(joined).toContain('Build the login page');
    expect(joined).toContain('Write API docs');
  });

  it('prints batches in dry-run mode', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: true, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    expect(result.exitCode).toBe(0);

    const joined = output.join('\n');
    expect(joined).toContain('Dry run');
    expect(joined).toContain('Batch');
  });

  it('validates output path is stored in result', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: false, output: 'report.md' },
      (msg: string) => output.push(msg),
    );

    expect(result.exitCode).toBe(0);
    expect(result.outputPath).toBe('report.md');
    const joined = output.join('\n');
    expect(joined).toContain('report.md');
  });

  it('returns error exit code when file is not found', async () => {
    const error = new Error('ENOENT: no such file or directory');
    (error as NodeJS.ErrnoException).code = 'ENOENT';
    vi.mocked(readFile).mockRejectedValue(error);

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'nonexistent.md', dryRun: false, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    expect(result.exitCode).toBe(1);
    expect(output.some(line => line.includes('not found') || line.includes('ENOENT'))).toBe(true);
  });

  it('returns error exit code on parse errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    expect(result.exitCode).toBe(1);
    expect(output.some(line => line.includes('Error'))).toBe(true);
  });

  it('handles file with no parseable tasks', async () => {
    vi.mocked(readFile).mockResolvedValue('# Just a heading\n\nNo tasks here.');

    const output: string[] = [];
    const result = await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    expect(result.exitCode).toBe(0);
    expect(output.some(line => line.includes('No tasks') || line.includes('0 tasks'))).toBe(true);
  });

  it('shows batch dependency info when tasks have dependencies', async () => {
    vi.mocked(readFile).mockResolvedValue(SAMPLE_TASKS_MD);

    const output: string[] = [];
    await run(
      { tasksFile: 'TASKS.md', dryRun: false, help: false, output: undefined },
      (msg: string) => output.push(msg),
    );

    const joined = output.join('\n');
    // The dependent task should be in a later batch
    expect(joined).toContain('Batch 2');
    expect(joined).toContain('Run integration tests');
  });
});
