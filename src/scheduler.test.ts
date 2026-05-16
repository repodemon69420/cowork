import { describe, it, expect } from 'vitest';
import { buildExecutionPlan } from './scheduler.js';
import { Task } from './types.js';

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

describe('buildExecutionPlan', () => {
  it('returns empty batches for empty array', () => {
    const plan = buildExecutionPlan([]);
    expect(plan).toEqual([]);
  });

  it('single pending task becomes a single batch', () => {
    const tasks = [makeTask({ title: 'Solo task' })];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('Solo task');
    expect(plan[0].parallel).toBe(false);
  });

  it('multiple independent tasks grouped into one parallel batch', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B' }),
      makeTask({ title: 'Task C' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks).toHaveLength(3);
    expect(plan[0].parallel).toBe(true);
  });

  it('tasks sorted by priority within batch (high before medium before low)', () => {
    const tasks = [
      makeTask({ title: 'Low task', priority: 'low' }),
      makeTask({ title: 'High task', priority: 'high' }),
      makeTask({ title: 'Medium task', priority: 'medium' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('High task');
    expect(plan[0].tasks[1].title).toBe('Medium task');
    expect(plan[0].tasks[2].title).toBe('Low task');
  });

  it('dependent task placed in later batch', () => {
    const tasks = [
      makeTask({ title: 'Build app', priority: 'high' }),
      makeTask({ title: 'Run tests', priority: 'medium', dependsOn: ['Build app'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(2);
    expect(plan[0].tasks[0].title).toBe('Build app');
    expect(plan[1].tasks[0].title).toBe('Run tests');
  });

  it('chain of dependencies creates multiple batches', () => {
    const tasks = [
      makeTask({ title: 'Step 1', priority: 'high' }),
      makeTask({ title: 'Step 2', priority: 'high', dependsOn: ['Step 1'] }),
      makeTask({ title: 'Step 3', priority: 'high', dependsOn: ['Step 2'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(3);
    expect(plan[0].tasks[0].title).toBe('Step 1');
    expect(plan[1].tasks[0].title).toBe('Step 2');
    expect(plan[2].tasks[0].title).toBe('Step 3');
  });

  it('already completed tasks excluded from plan', () => {
    const tasks = [
      makeTask({ title: 'Done task', status: 'completed' }),
      makeTask({ title: 'Pending task', status: 'pending' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('Pending task');
  });

  it('all completed tasks returns empty plan', () => {
    const tasks = [
      makeTask({ title: 'Done 1', status: 'completed' }),
      makeTask({ title: 'Done 2', status: 'completed' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toEqual([]);
  });

  it('failed tasks excluded from plan', () => {
    const tasks = [
      makeTask({ title: 'Failed task', status: 'failed' }),
      makeTask({ title: 'Pending task', status: 'pending' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('Pending task');
  });

  it('completed task satisfies dependency', () => {
    const tasks = [
      makeTask({ title: 'Build app', status: 'completed' }),
      makeTask({ title: 'Run tests', status: 'pending', dependsOn: ['Build app'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(1);
    expect(plan[0].tasks[0].title).toBe('Run tests');
  });

  it('circular/unresolvable dependencies still get scheduled', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    // Should still produce at least one batch with both tasks
    expect(plan.length).toBeGreaterThan(0);
    const allScheduled = plan.flatMap(b => b.tasks);
    expect(allScheduled).toHaveLength(2);
    const titles = allScheduled.map(t => t.title).sort();
    expect(titles).toEqual(['Task A', 'Task B']);
  });

  it('unresolvable dependency on non-existent task still gets scheduled', () => {
    const tasks = [
      makeTask({ title: 'Orphan task', dependsOn: ['Non-existent task'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);
    const allScheduled = plan.flatMap(b => b.tasks);
    expect(allScheduled).toHaveLength(1);
    expect(allScheduled[0].title).toBe('Orphan task');
  });

  it('mix of independent and dependent tasks batched correctly', () => {
    const tasks = [
      makeTask({ title: 'Independent A', priority: 'high' }),
      makeTask({ title: 'Independent B', priority: 'low' }),
      makeTask({ title: 'Depends on A', priority: 'medium', dependsOn: ['Independent A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(2);
    // First batch has both independent tasks
    expect(plan[0].tasks).toHaveLength(2);
    expect(plan[0].parallel).toBe(true);
    expect(plan[0].tasks[0].title).toBe('Independent A');
    expect(plan[0].tasks[1].title).toBe('Independent B');
    // Second batch has the dependent task
    expect(plan[1].tasks).toHaveLength(1);
    expect(plan[1].tasks[0].title).toBe('Depends on A');
  });
});
