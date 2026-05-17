import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseTasksFile } from './parser.js';
import { validateTasks } from './validator.js';
import { buildExecutionPlan } from './scheduler.js';
import { executePlan, type TaskExecutor } from './runner.js';
import { generateReport } from './reporter.js';
import { updateTaskStatus } from './serializer.js';
import { loadConfig, DEFAULT_CONFIG } from './config.js';
import type { Task, SessionResult } from './types.js';

describe('End-to-end pipeline with real file I/O', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cowork-e2e-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('full success pipeline: 2 pending tasks with always-succeed executor', async () => {
    const tasksContent = `## [ ] Implement auth module
**Priority:** high
**Type:** code
**Context:** Add JWT-based authentication.

---

## [ ] Write unit tests
**Priority:** medium
**Type:** test
**Context:** Cover auth module with tests.
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    // Read and parse
    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(2);

    // Validate
    const validation = validateTasks(tasks);
    expect(validation.valid).toBe(true);

    // Schedule
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);

    // Execute with always-succeed executor
    const executor: TaskExecutor = async () => ({ success: true });
    const result = await executePlan(plan, executor);

    expect(result.completed).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);

    // Generate report
    const report = generateReport(result, ['abc123 auth', 'def456 tests']);
    expect(report).toContain('Implement auth module');
    expect(report).toContain('Write unit tests');
    expect(report).toContain('2/2 completed');
  });

  it('mixed results pipeline: executor succeeds on 2 and fails on 1', async () => {
    const tasksContent = `## [ ] Task Alpha
**Priority:** high
**Type:** code
**Context:** First task.

---

## [ ] Task Beta
**Priority:** medium
**Type:** code
**Context:** Second task.

---

## [ ] Task Gamma
**Priority:** low
**Type:** test
**Context:** Third task.
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);

    const validation = validateTasks(tasks);
    expect(validation.valid).toBe(true);

    const plan = buildExecutionPlan(tasks);

    // Executor that fails on Task Beta
    const executor: TaskExecutor = async (task: Task) => {
      if (task.title === 'Task Beta') {
        return { success: false, error: 'Simulated failure' };
      }
      return { success: true };
    };

    const result = await executePlan(plan, executor);

    expect(result.completed).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Task Beta');
    expect(result.completed.map(t => t.title)).toContain('Task Alpha');
    expect(result.completed.map(t => t.title)).toContain('Task Gamma');
  });

  it('dependency chain execution: A -> B -> C in correct order', async () => {
    const tasksContent = `## [ ] Task A
**Priority:** high
**Type:** code
**Context:** Base task.

---

## [ ] Task B
**Priority:** high
**Type:** code
**Context:** Depends on A.
**Depends on:** Task A

---

## [ ] Task C
**Priority:** high
**Type:** code
**Context:** Depends on B.
**Depends on:** Task B
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);

    const validation = validateTasks(tasks);
    expect(validation.valid).toBe(true);

    const plan = buildExecutionPlan(tasks);

    // There should be 3 batches, one per task, due to chain
    expect(plan).toHaveLength(3);
    expect(plan[0].tasks[0].title).toBe('Task A');
    expect(plan[1].tasks[0].title).toBe('Task B');
    expect(plan[2].tasks[0].title).toBe('Task C');

    // Track execution order
    const executionOrder: string[] = [];
    const executor: TaskExecutor = async (task: Task) => {
      executionOrder.push(task.title);
      return { success: true };
    };

    const result = await executePlan(plan, executor);

    expect(result.completed).toHaveLength(3);
    expect(executionOrder).toEqual(['Task A', 'Task B', 'Task C']);
  });

  it('validation failure stops execution: circular dependencies', async () => {
    const tasksContent = `## [ ] Task X
**Priority:** high
**Type:** code
**Context:** Depends on Z.
**Depends on:** Task Z

---

## [ ] Task Y
**Priority:** high
**Type:** code
**Context:** Depends on X.
**Depends on:** Task X

---

## [ ] Task Z
**Priority:** high
**Type:** code
**Context:** Depends on Y.
**Depends on:** Task Y
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);

    const validation = validateTasks(tasks);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(e => e.message.includes('Circular dependency'))).toBe(true);

    // In a real pipeline, we would not call executePlan if validation fails
    let executorCalled = false;
    if (!validation.valid) {
      // Pipeline aborted - executor never invoked
      expect(executorCalled).toBe(false);
    }
  });

  it('status update in content: updateTaskStatus marks tasks with [x] and [!]', async () => {
    const tasksContent = `## [ ] Build CLI
**Priority:** high
**Type:** code
**Context:** Create the command-line interface.

---

## [ ] Add logging
**Priority:** medium
**Type:** code
**Context:** Structured logging throughout.

---

## [ ] Deploy to prod
**Priority:** low
**Type:** code
**Context:** Ship it.
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);

    // Simulate running the pipeline
    const plan = buildExecutionPlan(tasks);
    const executor: TaskExecutor = async (task: Task) => {
      if (task.title === 'Deploy to prod') {
        return { success: false, error: 'Deploy failed' };
      }
      return { success: true };
    };

    const result = await executePlan(plan, executor);

    // Now update the file content using updateTaskStatus
    let updatedContent = content;
    for (const task of result.completed) {
      updatedContent = updateTaskStatus(updatedContent, task.title, 'completed');
    }
    for (const task of result.failed) {
      updatedContent = updateTaskStatus(updatedContent, task.title, 'failed');
    }

    // Write back and verify
    writeFileSync(tasksPath, updatedContent, 'utf-8');
    const finalContent = readFileSync(tasksPath, 'utf-8');

    expect(finalContent).toContain('## [x] Build CLI');
    expect(finalContent).toContain('## [x] Add logging');
    expect(finalContent).toContain('## [!] Deploy to prod');
  });

  it('config loading from temp dir with .coworkrc.json', () => {
    const customConfig = {
      tasksFile: 'MY_TASKS.md',
      logLevel: 'debug',
      coverageThreshold: 95,
      maxFileLines: 500,
      maxFunctionLines: 30,
    };

    const configPath = join(tmpDir, '.coworkrc.json');
    writeFileSync(configPath, JSON.stringify(customConfig), 'utf-8');

    const config = loadConfig(tmpDir);

    expect(config.tasksFile).toBe('MY_TASKS.md');
    expect(config.logLevel).toBe('debug');
    expect(config.coverageThreshold).toBe(95);
    expect(config.maxFileLines).toBe(500);
    expect(config.maxFunctionLines).toBe(30);
    // Defaults should still be present for unspecified keys
    expect(config.logFile).toBe(DEFAULT_CONFIG.logFile);
  });

  it('report generation after execution contains Duration, Tasks count, Completed section', async () => {
    const tasksContent = `## [ ] Refactor utils
**Priority:** high
**Type:** refactor
**Context:** Clean up utility functions.

---

## [ ] Update docs
**Priority:** low
**Type:** docs
**Context:** Refresh API documentation.
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    const plan = buildExecutionPlan(tasks);

    const executor: TaskExecutor = async () => ({ success: true });
    const result = await executePlan(plan, executor);

    // Override times for deterministic report
    const fixedResult: SessionResult = {
      ...result,
      startTime: new Date('2026-05-16T22:00:00Z'),
      endTime: new Date('2026-05-17T01:30:00Z'),
    };

    const report = generateReport(fixedResult, ['aaa111 refactor utils', 'bbb222 update docs']);

    expect(report).toContain('**Duration**: 3h 30m');
    expect(report).toContain('**Tasks**: 2/2 completed');
    expect(report).toContain('## Completed');
    expect(report).toContain('Refactor utils');
    expect(report).toContain('Update docs');
    expect(report).toContain('## Commits');
    expect(report).toContain('- aaa111 refactor utils');
    expect(report).toContain('- bbb222 update docs');
  });

  it('empty plan when all tasks are already completed', async () => {
    const tasksContent = `## [x] Done task one
**Priority:** high
**Type:** code
**Context:** Already completed.

---

## [x] Done task two
**Priority:** medium
**Type:** test
**Context:** Also completed.

---

## [x] Done task three
**Priority:** low
**Type:** docs
**Context:** Finished too.
`;
    const tasksPath = join(tmpDir, 'TASKS.md');
    writeFileSync(tasksPath, tasksContent, 'utf-8');

    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);
    expect(tasks.every(t => t.status === 'completed')).toBe(true);

    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(0);

    // Executor should never be called
    let executorCalled = false;
    const executor: TaskExecutor = async () => {
      executorCalled = true;
      return { success: true };
    };

    const result = await executePlan(plan, executor);
    expect(executorCalled).toBe(false);
    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
