import { describe, it, expect } from 'vitest';

import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport } from './reporter.js';
import { validateTasks } from './validator.js';
import { runSession } from './runner.js';
import { serializeTasks, updateTaskStatus } from './writer.js';
import { checkKillSwitch } from './killswitch.js';
import { mergeConfig, DEFAULT_CONFIG } from './config.js';
import { run } from './cli.js';
import type { Task, SessionResult } from './types.js';

describe('Full pipeline integration', () => {
  it('parses TASKS.md content, builds execution plan, and generates report', () => {
    const content = `# Nightly Task Queue

> Run tasks overnight.

---

## [ ] Setup database schema
**Priority:** high
**Type:** code
**Context:** Create tables for users, sessions, and events.

---

## [ ] Write API endpoints
**Priority:** medium
**Type:** code
**Context:** Implement CRUD endpoints for the user model.
**Depends on:** Setup database schema

---

## [ ] Add integration tests
**Priority:** low
**Type:** test
**Context:** Test all endpoints with a real database connection.
**Depends on:** Write API endpoints

---

## [x] Initialize repository
**Priority:** high
**Type:** code
**Context:** Create the git repo and initial commit.
`;

    // Step 1: Parse
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(4);

    // Step 2: Build execution plan (only pending tasks are scheduled)
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);

    // The first batch should contain "Setup database schema" since
    // "Initialize repository" is already completed and "Setup database schema"
    // has no unmet dependencies.
    expect(plan[0].tasks[0].title).toBe('Setup database schema');

    // Step 3: Simulate execution - mark all pending tasks as completed
    const completedTasks: Task[] = tasks
      .filter(t => t.status === 'pending')
      .map(t => ({ ...t, status: 'completed' as const }));
    const alreadyCompleted = tasks.filter(t => t.status === 'completed');
    const allCompleted = [...alreadyCompleted, ...completedTasks];

    const result: SessionResult = {
      completed: allCompleted,
      failed: [],
      skipped: [],
      startTime: new Date('2026-05-15T22:00:00Z'),
      endTime: new Date('2026-05-16T06:30:00Z'),
    };

    // Step 4: Generate report
    const report = generateReport(result, ['abc123 Setup database schema', 'def456 Write API endpoints']);
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('**Duration**: 8h 30m');
    expect(report).toContain(`**Tasks**: ${allCompleted.length}/${allCompleted.length} completed`);
    expect(report).toContain('## Completed');
    expect(report).toContain('Setup database schema');
    expect(report).toContain('Write API endpoints');
    expect(report).toContain('Add integration tests');
    expect(report).toContain('Initialize repository');
    expect(report).toContain('## Commits');
    expect(report).toContain('- abc123 Setup database schema');
    expect(report).toContain('- def456 Write API endpoints');
    // No failed or skipped sections
    expect(report).not.toContain('## Failed');
    expect(report).not.toContain('## Skipped');
  });

  it('execution plan respects dependency ordering across batches', () => {
    const content = `## [ ] Task A
**Priority:** high
**Type:** code
**Context:** First task.

## [ ] Task B
**Priority:** high
**Type:** code
**Context:** Depends on A.
**Depends on:** Task A

## [ ] Task C
**Priority:** high
**Type:** code
**Context:** Depends on B.
**Depends on:** Task B
`;

    const tasks = parseTasksFile(content);
    const plan = buildExecutionPlan(tasks);

    // Three sequential batches because of the chain
    expect(plan).toHaveLength(3);
    expect(plan[0].tasks[0].title).toBe('Task A');
    expect(plan[1].tasks[0].title).toBe('Task B');
    expect(plan[2].tasks[0].title).toBe('Task C');
  });
});

describe('cross-module integration', () => {
  it('parse → validate → plan → run → report pipeline', () => {
    const content = `# Status: ON\n\n## [ ] Task A\n**Priority:** high\n**Type:** code\n**Context:** First\n\n---\n\n## [ ] Task B\n**Priority:** medium\n**Type:** test\n**Context:** Second\n\n---\n\n## [ ] Task C\n**Priority:** low\n**Type:** code\n**Context:** Third\n**Depends on:** Task A\n`;
    const tasks = parseTasksFile(content);
    const validation = validateTasks(tasks);
    expect(validation.errors).toHaveLength(0);
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);
    const result = runSession(tasks);
    expect(result.completed.length).toBe(3);
    const report = generateReport(result, []);
    expect(report).toContain('Completed');
    expect(report).toContain('3/3 completed');
  });

  it('parse → validate catches errors', () => {
    const content = `## [ ] Dup\n**Priority:** high\n**Type:** code\n**Context:** A\n\n## [ ] Dup\n**Priority:** high\n**Type:** code\n**Context:** B\n\n## [ ] X\n**Priority:** high\n**Type:** code\n**Context:** C\n**Depends on:** X\n`;
    const tasks = parseTasksFile(content);
    const validation = validateTasks(tasks);
    expect(validation.errors.some(e => e.type === 'duplicate-title')).toBe(true);
    expect(validation.errors.some(e => e.type === 'self-dependency')).toBe(true);
  });

  it('serialize → parse round-trip preserves data', () => {
    const tasks: Task[] = [
      { title: 'Alpha', priority: 'high', type: 'code', context: 'Build it', status: 'pending' },
      { title: 'Beta', priority: 'low', type: 'test', context: 'Test it', status: 'completed', dependsOn: ['Alpha'] },
    ];
    const serialized = serializeTasks(tasks);
    const parsed = parseTasksFile(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('Alpha');
    expect(parsed[0].priority).toBe('high');
    expect(parsed[0].status).toBe('pending');
    expect(parsed[1].title).toBe('Beta');
    expect(parsed[1].status).toBe('completed');
    expect(parsed[1].dependsOn).toEqual(['Alpha']);
  });

  it('killswitch + parse integration', () => {
    const content = `# Status: OFF\n\n## [ ] Task\n**Priority:** high\n**Type:** code\n**Context:** Something\n`;
    const ks = checkKillSwitch(content);
    expect(ks.active).toBe(false);
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
  });

  it('CLI validate with bad tasks returns exitCode 1', () => {
    const content = `## [ ] Dup\n**Priority:** high\n**Type:** code\n**Context:** A\n\n## [ ] Dup\n**Priority:** high\n**Type:** code\n**Context:** B\n`;
    const result = run(['validate'], content);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('duplicate-title');
  });

  it('CLI status with mixed tasks', () => {
    const content = `## [ ] P1\n**Priority:** high\n**Type:** code\n**Context:** A\n\n## [x] C1\n**Priority:** high\n**Type:** code\n**Context:** B\n\n## [!] F1\n**Priority:** high\n**Type:** code\n**Context:** C\n`;
    const result = run(['status'], content);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pending');
    expect(result.output).toContain('Completed');
    expect(result.output).toContain('Failed');
  });

  it('writer updateTaskStatus → parse round-trip', () => {
    const content = `## [ ] My Task\n**Priority:** high\n**Type:** code\n**Context:** Do it\n`;
    const updated = updateTaskStatus(content, 'My Task', 'completed');
    expect(updated).toContain('[x] My Task');
    const tasks = parseTasksFile(updated);
    expect(tasks[0].status).toBe('completed');
  });

  it('config mergeConfig with empty partial returns defaults', () => {
    const config = mergeConfig({});
    expect(config.tasksFile).toBe(DEFAULT_CONFIG.tasksFile);
    expect(config.reportFile).toBe(DEFAULT_CONFIG.reportFile);
    expect(config.statusLine).toBe(DEFAULT_CONFIG.statusLine);
  });
});
