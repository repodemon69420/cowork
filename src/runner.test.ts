import { describe, it, expect } from 'vitest';
import { createSessionResult, runSession, summarizeSession } from './runner.js';
import { Task, SessionResult } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Default task',
    priority: 'medium',
    type: 'code',
    context: '',
    status: 'pending',
    ...overrides,
  };
}

describe('createSessionResult', () => {
  it('creates a valid result with provided dates', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-01T01:30:00Z');
    const completed = [makeTask({ title: 'A', status: 'completed' })];
    const failed = [makeTask({ title: 'B', status: 'failed' })];
    const skipped = [makeTask({ title: 'C', status: 'skipped' })];

    const result = createSessionResult(completed, failed, skipped, start, end);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('A');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('B');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].title).toBe('C');
    expect(result.startTime).toBe(start);
    expect(result.endTime).toBe(end);
  });

  it('uses current date when dates not provided', () => {
    const before = new Date();
    const result = createSessionResult([], [], []);
    const after = new Date();

    expect(result.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.startTime.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(result.endTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('runSession', () => {
  it('with all pending tasks marks them all completed', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B' }),
      makeTask({ title: 'Task C' }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.completed.every(t => t.status === 'completed')).toBe(true);
  });

  it('preserves already-completed tasks', () => {
    const tasks = [
      makeTask({ title: 'Already done', status: 'completed' }),
      makeTask({ title: 'New task', status: 'pending' }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(2);
    const titles = result.completed.map(t => t.title);
    expect(titles).toContain('Already done');
    expect(titles).toContain('New task');
  });

  it('preserves already-failed tasks', () => {
    const tasks = [
      makeTask({ title: 'Failed one', status: 'failed' }),
      makeTask({ title: 'Pending one', status: 'pending' }),
    ];

    const result = runSession(tasks);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Failed one');
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Pending one');
  });

  it('with mixed statuses sorts correctly', () => {
    const tasks = [
      makeTask({ title: 'Done', status: 'completed' }),
      makeTask({ title: 'Broken', status: 'failed' }),
      makeTask({ title: 'Todo', status: 'pending' }),
    ];

    const result = runSession(tasks);

    expect(result.completed.map(t => t.title)).toContain('Done');
    expect(result.completed.map(t => t.title)).toContain('Todo');
    expect(result.failed.map(t => t.title)).toEqual(['Broken']);
    expect(result.skipped).toHaveLength(0);
  });

  it('with empty task array returns empty result', () => {
    const result = runSession([]);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
  });

  it('with dependencies processes in correct order', () => {
    const tasks = [
      makeTask({ title: 'Build', priority: 'high' }),
      makeTask({ title: 'Test', priority: 'medium', dependsOn: ['Build'] }),
      makeTask({ title: 'Deploy', priority: 'low', dependsOn: ['Test'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(3);
    const titles = result.completed.map(t => t.title);
    expect(titles.indexOf('Build')).toBeLessThan(titles.indexOf('Test'));
    expect(titles.indexOf('Test')).toBeLessThan(titles.indexOf('Deploy'));
  });

  it('creates new task objects (immutability)', () => {
    const original = makeTask({ title: 'Original' });
    const result = runSession([original]);

    expect(original.status).toBe('pending');
    expect(result.completed[0].status).toBe('completed');
    expect(result.completed[0]).not.toBe(original);
  });

  it('skips tasks with circular dependencies', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every(t => t.status === 'skipped')).toBe(true);
    const skippedTitles = result.skipped.map(t => t.title);
    expect(skippedTitles).toContain('A');
    expect(skippedTitles).toContain('B');
    expect(result.failed).toHaveLength(0);
  });

  it('skips tasks with circular deps while completing independent tasks', () => {
    const tasks = [
      makeTask({ title: 'Independent', priority: 'high' }),
      makeTask({ title: 'CycleA', dependsOn: ['CycleB'] }),
      makeTask({ title: 'CycleB', dependsOn: ['CycleA'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed.map(t => t.title)).toContain('Independent');
    expect(result.skipped).toHaveLength(2);
    const skippedTitles = result.skipped.map(t => t.title);
    expect(skippedTitles).toContain('CycleA');
    expect(skippedTitles).toContain('CycleB');
  });

  it('with all tasks already completed returns them with no pending work', () => {
    const tasks = [
      makeTask({ title: 'Done1', status: 'completed' }),
      makeTask({ title: 'Done2', status: 'completed' }),
      makeTask({ title: 'Done3', status: 'completed' }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.completed.map(t => t.title)).toEqual(['Done1', 'Done2', 'Done3']);
  });

  it('with all tasks already failed returns them with no completed or skipped', () => {
    const tasks = [
      makeTask({ title: 'Fail1', status: 'failed' }),
      makeTask({ title: 'Fail2', status: 'failed' }),
      makeTask({ title: 'Fail3', status: 'failed' }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed.map(t => t.title)).toEqual(['Fail1', 'Fail2', 'Fail3']);
  });

  it('handles mixed scenario: completed, failed, pending, and unresolvable deps', () => {
    const tasks = [
      makeTask({ title: 'AlreadyDone', status: 'completed' }),
      makeTask({ title: 'AlreadyFailed', status: 'failed' }),
      makeTask({ title: 'Doable', status: 'pending' }),
      makeTask({ title: 'CycleX', status: 'pending', dependsOn: ['CycleY'] }),
      makeTask({ title: 'CycleY', status: 'pending', dependsOn: ['CycleX'] }),
      makeTask({ title: 'DepOnMissing', status: 'pending', dependsOn: ['NonExistent'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed.map(t => t.title)).toContain('AlreadyDone');
    expect(result.completed.map(t => t.title)).toContain('Doable');
    expect(result.failed.map(t => t.title)).toEqual(['AlreadyFailed']);
    expect(result.skipped.length).toBeGreaterThanOrEqual(3);
    const skippedTitles = result.skipped.map(t => t.title);
    expect(skippedTitles).toContain('CycleX');
    expect(skippedTitles).toContain('CycleY');
    expect(skippedTitles).toContain('DepOnMissing');
  });

  it('handles a large batch of 10+ independent pending tasks', () => {
    const tasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({ title: `Task-${i}`, status: 'pending' }),
    );

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(15);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.completed.every(t => t.status === 'completed')).toBe(true);
    for (let i = 0; i < 15; i++) {
      expect(result.completed.map(t => t.title)).toContain(`Task-${i}`);
    }
  });

  it('skips task depending on a non-existent task', () => {
    const tasks = [
      makeTask({ title: 'Orphan', dependsOn: ['GhostTask'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].title).toBe('Orphan');
    expect(result.skipped[0].status).toBe('skipped');
  });

  it('handles three-way circular dependency', () => {
    const tasks = [
      makeTask({ title: 'X', dependsOn: ['Z'] }),
      makeTask({ title: 'Y', dependsOn: ['X'] }),
      makeTask({ title: 'Z', dependsOn: ['Y'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map(t => t.title).sort()).toEqual(['X', 'Y', 'Z']);
  });

  it('completes chain after resolving deps but skips unresolvable ones', () => {
    const tasks = [
      makeTask({ title: 'Base', priority: 'high' }),
      makeTask({ title: 'Step2', priority: 'medium', dependsOn: ['Base'] }),
      makeTask({ title: 'Step3', priority: 'low', dependsOn: ['Step2'] }),
      makeTask({ title: 'Stuck', priority: 'low', dependsOn: ['Phantom'] }),
    ];

    const result = runSession(tasks);

    expect(result.completed.map(t => t.title)).toContain('Base');
    expect(result.completed.map(t => t.title)).toContain('Step2');
    expect(result.completed.map(t => t.title)).toContain('Step3');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].title).toBe('Stuck');
  });
});

describe('summarizeSession', () => {
  it('returns correct format', () => {
    const result: SessionResult = {
      completed: [makeTask({ status: 'completed' }), makeTask({ status: 'completed' })],
      failed: [makeTask({ status: 'failed' })],
      skipped: [makeTask({ status: 'skipped' })],
      startTime: new Date('2025-01-01T00:00:00Z'),
      endTime: new Date('2025-01-01T00:05:00Z'),
    };

    const summary = summarizeSession(result);

    expect(summary).toBe('Session complete: 2 completed, 1 failed, 1 skipped (duration: 5m)');
  });

  it('with all zeros', () => {
    const now = new Date();
    const result: SessionResult = {
      completed: [],
      failed: [],
      skipped: [],
      startTime: now,
      endTime: now,
    };

    const summary = summarizeSession(result);

    expect(summary).toBe('Session complete: 0 completed, 0 failed, 0 skipped (duration: 0m)');
  });
});
