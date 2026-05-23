import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './cli.js';
import type { CliArgs } from './cli.js';
import type { TaskRunner } from './executor.js';
import type { Task } from './types.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cowork-pipeline-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function tasksPath(): string {
  return join(tempDir, 'TASKS.md');
}

function reportPath(): string {
  return join(tempDir, 'report.md');
}

function makeArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
    tasksFile: tasksPath(),
    dryRun: false,
    help: false,
    output: undefined,
    ...overrides,
  };
}

function collectOutput(): { lines: string[]; print: (msg: string) => void } {
  const lines: string[] = [];
  return { lines, print: (msg: string) => lines.push(msg) };
}

describe('CLI pipeline integration', () => {
  it('success path: reads, parses, schedules, executes, and writes report', async () => {
    const fixture = `# Tasks

## [ ] Alpha task
- **Priority:** high
- **Type:** code
- **Context:** First task

## [ ] Beta task
- **Priority:** medium
- **Type:** docs
- **Context:** Second task
`;
    await writeFile(tasksPath(), fixture, 'utf-8');

    const mockRunner: TaskRunner = vi.fn(async () => {});
    const { lines, print } = collectOutput();
    const outPath = reportPath();

    const result = await run(
      makeArgs({ output: outPath }),
      print,
      mockRunner,
    );

    expect(result.exitCode).toBe(0);
    expect(result.outputPath).toBe(outPath);

    const report = await readFile(outPath, 'utf-8');
    expect(report.toLowerCase()).toContain('completed');

    const joined = lines.join('\n');
    expect(joined).toContain('Alpha task');
    expect(joined).toContain('Beta task');
    expect(joined).toContain('Batch');
  });

  it('partial failure: report reflects both completed and failed tasks', async () => {
    const fixture = `# Tasks

## [ ] Succeed one
- **Priority:** high
- **Type:** code
- **Context:** Will pass

## [ ] Fail one
- **Priority:** medium
- **Type:** test
- **Context:** Will fail

## [ ] Succeed two
- **Priority:** low
- **Type:** docs
- **Context:** Will also pass
`;
    await writeFile(tasksPath(), fixture, 'utf-8');

    const mockRunner: TaskRunner = vi.fn(async (task: Task) => {
      if (task.title === 'Fail one') {
        throw new Error('simulated failure');
      }
    });
    const { print } = collectOutput();
    const outPath = reportPath();

    const result = await run(
      makeArgs({ output: outPath }),
      print,
      mockRunner,
    );

    expect(result.exitCode).toBe(0);

    const report = await readFile(outPath, 'utf-8');
    expect(report).toContain('Failed');
    expect(report).toContain('Fail one');
    expect(report).toContain('Completed');
    expect(report).toContain('Succeed one');
    expect(report).toContain('Succeed two');
  });

  it('missing file: returns exit code 1 with not-found message', async () => {
    const { lines, print } = collectOutput();

    const result = await run(
      makeArgs({ tasksFile: join(tempDir, 'nonexistent.md') }),
      print,
    );

    expect(result.exitCode).toBe(1);
    const joined = lines.join('\n').toLowerCase();
    expect(joined).toContain('not found');
  });

  it('dry-run mode: prints plan, writes no report, never calls runner', async () => {
    const fixture = `# Tasks

## [ ] Dry task
- **Priority:** high
- **Type:** code
- **Context:** Should not run
`;
    await writeFile(tasksPath(), fixture, 'utf-8');

    const mockRunner: TaskRunner = vi.fn(async () => {});
    const { lines, print } = collectOutput();
    const outPath = reportPath();

    const result = await run(
      makeArgs({ dryRun: true, output: outPath }),
      print,
      mockRunner,
    );

    expect(result.exitCode).toBe(0);

    const joined = lines.join('\n');
    expect(joined).toContain('Dry run');

    expect(mockRunner).not.toHaveBeenCalled();

    let reportExists = true;
    try {
      await readFile(outPath, 'utf-8');
    } catch {
      reportExists = false;
    }
    expect(reportExists).toBe(false);
  });

  it('empty tasks file: prints no-tasks message', async () => {
    const fixture = `# Just a heading

Nothing parseable here.
`;
    await writeFile(tasksPath(), fixture, 'utf-8');

    const { lines, print } = collectOutput();

    const result = await run(makeArgs(), print);

    expect(result.exitCode).toBe(0);
    const joined = lines.join('\n');
    expect(joined).toContain('No tasks');
  });

  it('with dependencies: dependent task runs after its dependency', async () => {
    const fixture = `# Tasks

## [ ] Task A
- **Priority:** high
- **Type:** code
- **Context:** Must run first

## [ ] Task B
- **Priority:** high
- **Type:** code
- **Context:** Runs after A
- **Depends on:** Task A
`;
    await writeFile(tasksPath(), fixture, 'utf-8');

    const callOrder: string[] = [];
    const mockRunner: TaskRunner = vi.fn(async (task: Task) => {
      callOrder.push(task.title);
    });
    const { print } = collectOutput();

    await run(makeArgs(), print, mockRunner);

    const indexA = callOrder.indexOf('Task A');
    const indexB = callOrder.indexOf('Task B');
    expect(indexA).toBeGreaterThanOrEqual(0);
    expect(indexB).toBeGreaterThanOrEqual(0);
    expect(indexA).toBeLessThan(indexB);
  });
});
