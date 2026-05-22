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
