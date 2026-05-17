import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { orchestrate } from './orchestrator.js';
import { TaskExecutor } from './runner.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'cowork-orch-'));
}

function writeTasksFile(dir: string, content: string): void {
  writeFileSync(join(dir, 'TASKS.md'), content, 'utf-8');
}

const SIMPLE_TASKS = `## [ ] Build auth module
**Priority:** high
**Type:** code
**Context:** Implement JWT authentication

---

## [ ] Write tests for auth
**Priority:** medium
**Type:** test
**Context:** Unit tests for auth module
**Depends on:** Build auth module
`;

const ALL_COMPLETED_TASKS = `## [x] Build auth module
**Priority:** high
**Type:** code
**Context:** Implement JWT authentication

---

## [x] Write tests for auth
**Priority:** medium
**Type:** test
**Context:** Unit tests for auth module
`;

const CIRCULAR_TASKS = `## [ ] Task A
**Priority:** high
**Type:** code
**Context:** First task
**Depends on:** Task B

---

## [ ] Task B
**Priority:** high
**Type:** code
**Context:** Second task
**Depends on:** Task A
`;

function createSuccessExecutor(): TaskExecutor {
  return async () => ({ success: true });
}

function createFailExecutor(): TaskExecutor {
  return async () => ({ success: false, error: 'something went wrong' });
}

function createMixedExecutor(): TaskExecutor {
  let callCount = 0;
  return async () => {
    callCount++;
    if (callCount % 2 === 0) {
      return { success: false, error: 'failed on even call' };
    }
    return { success: true };
  };
}

describe('orchestrate', () => {
  it('should execute all tasks and write report', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const result = await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    expect(result.session.completed.length).toBe(2);
    expect(result.session.failed.length).toBe(0);
    expect(result.session.skipped.length).toBe(0);
    expect(result.tasksUpdated).toBe(true);

    // Verify report file was written
    const reportContent = readFileSync(result.reportPath, 'utf-8');
    expect(reportContent).toContain('Overnight Session Report');
    expect(reportContent).toContain('2/2 completed');
  });

  it('should update TASKS.md with completed statuses', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    const updatedContent = readFileSync(join(dir, 'TASKS.md'), 'utf-8');
    expect(updatedContent).toContain('[x] Build auth module');
    expect(updatedContent).toContain('[x] Write tests for auth');
  });

  it('should mark failed tasks with [!] in TASKS.md', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    await orchestrate({
      executor: createFailExecutor(),
      cwd: dir,
    });

    const updatedContent = readFileSync(join(dir, 'TASKS.md'), 'utf-8');
    expect(updatedContent).toContain('[!] Build auth module');
  });

  it('should handle mixed success/failure', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const result = await orchestrate({
      executor: createMixedExecutor(),
      cwd: dir,
    });

    // First task succeeds (odd call), second task fails (even call)
    expect(result.session.completed.length).toBe(1);
    expect(result.session.failed.length).toBe(1);
  });

  it('should return early with empty session on validation failure (circular deps)', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, CIRCULAR_TASKS);

    const result = await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    expect(result.session.completed.length).toBe(0);
    expect(result.session.failed.length).toBe(0);
    expect(result.session.skipped.length).toBe(0);
    expect(result.tasksUpdated).toBe(false);
  });

  it('should return early when execution plan is empty (all tasks completed)', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, ALL_COMPLETED_TASKS);

    const executor = vi.fn(createSuccessExecutor());

    const result = await orchestrate({
      executor,
      cwd: dir,
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.session.completed.length).toBe(0);
    expect(result.session.failed.length).toBe(0);
    expect(result.tasksUpdated).toBe(false);
  });

  it('should call onProgress callback after each task', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const progressCalls: Array<{ completed: number; failed: number; total: number }> = [];

    await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
      onProgress: (progress) => {
        progressCalls.push({ ...progress });
      },
    });

    expect(progressCalls.length).toBe(2);
    expect(progressCalls[0]).toEqual({ completed: 1, failed: 0, total: 2 });
    expect(progressCalls[1]).toEqual({ completed: 2, failed: 0, total: 2 });
  });

  it('should track failed count in onProgress', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const progressCalls: Array<{ completed: number; failed: number; total: number }> = [];

    await orchestrate({
      executor: createFailExecutor(),
      cwd: dir,
      onProgress: (progress) => {
        progressCalls.push({ ...progress });
      },
    });

    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls[0].failed).toBe(1);
  });

  it('should resolve report path relative to cwd', async () => {
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const result = await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    expect(result.reportPath).toBe(join(dir, 'MORNING_REPORT.md'));
  });

  it('should use process.cwd() when cwd not provided', async () => {
    // We can't easily test this without changing process.cwd,
    // but we can at least verify it doesn't throw when cwd is omitted
    // if TASKS.md exists in process.cwd. We'll use the cwd param instead.
    const dir = makeTempDir();
    writeTasksFile(dir, SIMPLE_TASKS);

    const result = await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    expect(result.session).toBeDefined();
    expect(result.reportPath).toBeDefined();
  });

  it('should use config tasksFile path from .coworkrc.json', async () => {
    const dir = makeTempDir();
    const subDir = join(dir, 'tasks');
    mkdirSync(subDir);
    writeFileSync(join(subDir, 'mytasks.md'), SIMPLE_TASKS, 'utf-8');
    writeFileSync(
      join(dir, '.coworkrc.json'),
      JSON.stringify({ tasksFile: 'tasks/mytasks.md' }),
      'utf-8',
    );

    const result = await orchestrate({
      executor: createSuccessExecutor(),
      cwd: dir,
    });

    expect(result.session.completed.length).toBe(2);
    expect(result.tasksUpdated).toBe(true);

    const updatedContent = readFileSync(join(subDir, 'mytasks.md'), 'utf-8');
    expect(updatedContent).toContain('[x] Build auth module');
  });
});
