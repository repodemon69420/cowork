import { describe, it, expect } from 'vitest';

import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport } from './reporter.js';
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
