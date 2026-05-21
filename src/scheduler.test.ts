import { describe, it, expect } from 'vitest';
import { buildExecutionPlan, detectCircularDependencies } from './scheduler.js';
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

  it('circular dependencies result in error batch with circular flag', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.length).toBeGreaterThan(0);
    const lastBatch = plan[plan.length - 1];
    expect(lastBatch.circular).toBe(true);
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

  it('buildExecutionPlan marks circular batch but not normal batches', () => {
    const tasks = [
      makeTask({ title: 'Normal', priority: 'high' }),
      makeTask({ title: 'Cycle A', dependsOn: ['Cycle B'] }),
      makeTask({ title: 'Cycle B', dependsOn: ['Cycle A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan).toHaveLength(2);
    expect(plan[0].circular).toBeUndefined();
    expect(plan[0].tasks[0].title).toBe('Normal');
    expect(plan[1].circular).toBe(true);
    const circularTitles = plan[1].tasks.map(t => t.title).sort();
    expect(circularTitles).toEqual(['Cycle A', 'Cycle B']);
  });
});

describe('detectCircularDependencies', () => {
  it('returns empty array when there are no cycles', () => {
    const tasks = [
      makeTask({ title: 'Task A', priority: 'high' }),
      makeTask({ title: 'Task B', priority: 'medium', dependsOn: ['Task A'] }),
      makeTask({ title: 'Task C', priority: 'low', dependsOn: ['Task B'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toEqual([]);
  });

  it('detects a self-referencing task (A depends on A)', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task A'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Task A');
  });

  it('detects a two-node cycle (A→B→A)', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Task A');
    expect(cycles[0]).toContain('Task B');
  });

  it('detects a longer chain cycle (A→B→C→A)', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task C'] }),
      makeTask({ title: 'Task C', dependsOn: ['Task A'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Task A');
    expect(cycles[0]).toContain('Task B');
    expect(cycles[0]).toContain('Task C');
  });

  it('returns empty array for a mix of valid tasks with no cycles', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
      makeTask({ title: 'Task C' }),
      makeTask({ title: 'Task D', dependsOn: ['Task B', 'Task C'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toEqual([]);
  });

  it('detects cycles while valid tasks exist alongside', () => {
    const tasks = [
      makeTask({ title: 'Valid 1' }),
      makeTask({ title: 'Valid 2', dependsOn: ['Valid 1'] }),
      makeTask({ title: 'Cycle A', dependsOn: ['Cycle B'] }),
      makeTask({ title: 'Cycle B', dependsOn: ['Cycle A'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Cycle A');
    expect(cycles[0]).toContain('Cycle B');
    // Valid tasks should not appear in any cycle
    const allCycleTitles = cycles.flat();
    expect(allCycleTitles).not.toContain('Valid 1');
    expect(allCycleTitles).not.toContain('Valid 2');
  });

  it('detects multiple independent cycles', () => {
    const tasks = [
      makeTask({ title: 'A1', dependsOn: ['A2'] }),
      makeTask({ title: 'A2', dependsOn: ['A1'] }),
      makeTask({ title: 'B1', dependsOn: ['B2'] }),
      makeTask({ title: 'B2', dependsOn: ['B3'] }),
      makeTask({ title: 'B3', dependsOn: ['B1'] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles).toHaveLength(2);
    const cycleLengths = cycles.map(c => c.length).sort();
    expect(cycleLengths).toEqual([2, 3]);
  });

  it('does not mutate the input tasks array', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const tasksCopy = JSON.parse(JSON.stringify(tasks));
    detectCircularDependencies(tasks);
    expect(tasks).toEqual(tasksCopy);
  });
});
