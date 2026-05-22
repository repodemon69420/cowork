import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport } from './reporter.js';
import type { Task, SessionResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Real TASKS.md from this project', () => {
  it('parses the actual TASKS.md file successfully', () => {
    const tasksPath = resolve(__dirname, '../TASKS.md');
    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);

    // The actual TASKS.md has at least one task
    expect(tasks.length).toBeGreaterThanOrEqual(1);

    // Verify each task has required fields
    for (const task of tasks) {
      expect(task.title).toBeDefined();
      expect(task.title.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(task.priority);
      expect(['code', 'research', 'docs', 'refactor', 'test', 'design']).toContain(task.type);
      expect(['pending', 'completed', 'failed', 'skipped']).toContain(task.status);
      expect(typeof task.context).toBe('string');
    }

    // Check the first real task from TASKS.md (we know it exists)
    const scaffoldTask = tasks.find(t => t.title.includes('Scaffold the project structure'));
    expect(scaffoldTask).toBeDefined();
    expect(scaffoldTask!.priority).toBe('high');
    expect(scaffoldTask!.type).toBe('code');
    expect(scaffoldTask!.status).toBe('completed');

    // The second task depends on the first
    const testTask = tasks.find(t => t.title.includes('Write unit tests for core utilities'));
    expect(testTask).toBeDefined();
    expect(testTask!.dependsOn).toContain('Scaffold the project structure');
  });

  it('builds an execution plan from the actual TASKS.md', () => {
    const tasksPath = resolve(__dirname, '../TASKS.md');
    const content = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasksFile(content);
    const plan = buildExecutionPlan(tasks);

    // The plan should be an array (possibly empty if all tasks are completed)
    expect(Array.isArray(plan)).toBe(true);

    // Each batch should have tasks and a parallel flag
    for (const batch of plan) {
      expect(batch.tasks.length).toBeGreaterThan(0);
      expect(typeof batch.parallel).toBe('boolean');
    }
  });
});

describe('Edge cases pipeline', () => {
  it('all tasks already completed results in empty execution plan and report shows all completed', () => {
    const content = `## [x] Task One
**Priority:** high
**Type:** code
**Context:** Already done.

## [x] Task Two
**Priority:** medium
**Type:** test
**Context:** Also done.
`;

    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(2);
    expect(tasks.every(t => t.status === 'completed')).toBe(true);

    // No pending tasks, so execution plan should be empty
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(0);

    // Generate report with all tasks completed
    const result: SessionResult = {
      completed: tasks,
      failed: [],
      skipped: [],
      startTime: new Date('2026-05-15T23:00:00Z'),
      endTime: new Date('2026-05-16T01:00:00Z'),
    };
    const report = generateReport(result, []);
    expect(report).toContain('## Completed');
    expect(report).toContain('Task One');
    expect(report).toContain('Task Two');
    expect(report).toContain('2/2 completed');
    expect(report).not.toContain('## Failed');
    expect(report).not.toContain('## Skipped');
    expect(report).not.toContain('## Commits');
  });

  it('all tasks failed results in report showing failures', () => {
    const content = `## [!] Broken task A
**Priority:** high
**Type:** code
**Context:** This failed.

## [!] Broken task B
**Priority:** medium
**Type:** test
**Context:** This also failed.
`;

    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(2);
    expect(tasks.every(t => t.status === 'failed')).toBe(true);

    // Build plan - no pending tasks
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(0);

    // Generate report with all failures
    const result: SessionResult = {
      completed: [],
      failed: tasks,
      skipped: [],
      startTime: new Date('2026-05-15T23:00:00Z'),
      endTime: new Date('2026-05-16T00:15:00Z'),
    };
    const report = generateReport(result, []);
    expect(report).toContain('**Tasks**: 0/2 completed');
    expect(report).toContain('## Failed');
    expect(report).toContain('Broken task A');
    expect(report).toContain('Broken task B');
    expect(report).not.toContain('## Completed');
    expect(report).not.toContain('## Skipped');
  });

  it('task with non-existent dependency is handled by scheduler', () => {
    const content = `## [ ] Orphan task
**Priority:** high
**Type:** code
**Context:** Depends on something that does not exist.
**Depends on:** Non-existent task

## [ ] Independent task
**Priority:** medium
**Type:** code
**Context:** Has no dependencies.
`;

    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(2);

    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);

    // The independent task should be scheduled first since the orphan task
    // depends on a non-existent task (unmet dependency)
    expect(plan[0].tasks.some(t => t.title === 'Independent task')).toBe(true);

    // The orphan task will eventually be placed in a batch (as "remaining" when
    // no more ready tasks exist, since "Non-existent task" never gets completed)
    const allPlannedTitles = plan.flatMap(b => b.tasks.map(t => t.title));
    expect(allPlannedTitles).toContain('Orphan task');
  });

  it('very long task title and context cause no truncation or errors', () => {
    const longTitle = 'A'.repeat(500);
    const longContext = 'B'.repeat(5000);
    const content = `## [ ] ${longTitle}
**Priority:** low
**Type:** research
**Context:** ${longContext}
`;

    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe(longTitle);
    expect(tasks[0].title).toHaveLength(500);
    expect(tasks[0].context).toBe(longContext);
    expect(tasks[0].context).toHaveLength(5000);

    // Build plan
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe(longTitle);

    // Generate report
    const result: SessionResult = {
      completed: [{ ...tasks[0], status: 'completed' }],
      failed: [],
      skipped: [],
      startTime: new Date('2026-05-15T23:00:00Z'),
      endTime: new Date('2026-05-16T01:00:00Z'),
    };
    const report = generateReport(result, []);
    expect(report).toContain(longTitle);
    expect(report).toContain(longContext);
  });

  it('unicode characters in task titles and context', () => {
    const content = `## [ ] Deploy — production \u{1F680}\u{1F30D}
**Priority:** high
**Type:** code
**Context:** 测试中文内容 • élève café • \u{1F4A1} Привет мир

## [ ] Tâche avec accents àéïöü
**Priority:** medium
**Type:** docs
**Context:** ☃ Snowman ❤ Heart ★ Star ♠♣♥♦

## [ ] 日本語タスク
**Priority:** low
**Type:** research
**Context:** これは日本語のコンテキストです。
`;

    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);

    expect(tasks[0].title).toBe('Deploy — production \u{1F680}\u{1F30D}');
    expect(tasks[0].context).toBe('测试中文内容 • élève café • \u{1F4A1} Привет мир');

    expect(tasks[1].title).toBe('Tâche avec accents àéïöü');
    expect(tasks[1].context).toBe('☃ Snowman ❤ Heart ★ Star ♠♣♥♦');

    expect(tasks[2].title).toBe('日本語タスク');
    expect(tasks[2].context).toBe('これは日本語のコンテキストです。');

    // Build plan and generate report with unicode content
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);

    const result: SessionResult = {
      completed: tasks.map(t => ({ ...t, status: 'completed' as const })),
      failed: [],
      skipped: [],
      startTime: new Date('2026-05-15T23:00:00Z'),
      endTime: new Date('2026-05-16T02:00:00Z'),
    };
    const report = generateReport(result, ['abc123 Deploy \u{1F680}']);
    expect(report).toContain('Deploy — production \u{1F680}\u{1F30D}');
    expect(report).toContain('日本語タスク');
    expect(report).toContain('これは日本語のコンテキストです。');
    expect(report).toContain('abc123 Deploy \u{1F680}');
  });

  it('mixed results with completed, failed, and skipped tasks', () => {
    const completedTask: Task = {
      title: 'Passed task',
      priority: 'high',
      type: 'code',
      context: 'This succeeded.',
      status: 'completed',
    };
    const failedTask: Task = {
      title: 'Failed task',
      priority: 'medium',
      type: 'test',
      context: 'This broke.',
      status: 'failed',
    };
    const skippedTask: Task = {
      title: 'Skipped task',
      priority: 'low',
      type: 'docs',
      context: 'Dependency failed.',
      status: 'skipped',
    };

    const result: SessionResult = {
      completed: [completedTask],
      failed: [failedTask],
      skipped: [skippedTask],
      startTime: new Date('2026-05-15T22:00:00Z'),
      endTime: new Date('2026-05-16T04:00:00Z'),
    };

    const report = generateReport(result, ['commit1']);
    expect(report).toContain('**Tasks**: 1/3 completed');
    expect(report).toContain('## Completed');
    expect(report).toContain('## Failed');
    expect(report).toContain('## Skipped');
    expect(report).toContain('Passed task');
    expect(report).toContain('Failed task');
    expect(report).toContain('Skipped task');
  });
});

describe('Re-export verification', () => {
  it('all expected exports are available from index', async () => {
    const indexModule = await import('./index.js');

    // Verify function exports
    expect(typeof indexModule.parseTasksFile).toBe('function');
    expect(typeof indexModule.buildExecutionPlan).toBe('function');
    expect(typeof indexModule.generateReport).toBe('function');
    expect(typeof indexModule.formatTaskSection).toBe('function');
  });

  it('parseTasksFile from index works correctly', async () => {
    const { parseTasksFile: parse } = await import('./index.js');
    const tasks = parse(`## [ ] Test task
**Priority:** high
**Type:** code
**Context:** Works from re-export.
`);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Test task');
  });

  it('buildExecutionPlan from index works correctly', async () => {
    const { buildExecutionPlan: build } = await import('./index.js');
    const tasks: Task[] = [
      { title: 'A', priority: 'high', type: 'code', context: '', status: 'pending' },
    ];
    const plan = build(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('A');
  });

  it('generateReport from index works correctly', async () => {
    const { generateReport: report } = await import('./index.js');
    const result: SessionResult = {
      completed: [{ title: 'Done', priority: 'high', type: 'code', context: '', status: 'completed' }],
      failed: [],
      skipped: [],
      startTime: new Date('2026-05-16T00:00:00Z'),
      endTime: new Date('2026-05-16T01:00:00Z'),
    };
    const output = report(result, []);
    expect(output).toContain('# Overnight Session Report');
    expect(output).toContain('Done');
  });

  it('formatTaskSection from index works correctly', async () => {
    const { formatTaskSection: fmt } = await import('./index.js');
    const task: Task = {
      title: 'My Task',
      priority: 'medium',
      type: 'docs',
      context: 'Some context here.',
      status: 'completed',
    };
    const output = fmt(task);
    expect(output).toContain('## [x] My Task');
    expect(output).toContain('- **type**: docs');
    expect(output).toContain('- **priority**: medium');
    expect(output).toContain('- **context**: Some context here.');
  });
});
