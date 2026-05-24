import { describe, it, expect } from 'vitest';
import { buildExecutionPlan, detectCycles } from './scheduler.js';
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
    expect(plan.batches).toEqual([]);
    expect(plan.cycles).toEqual([]);
  });

  it('single pending task becomes a single batch', () => {
    const tasks = [makeTask({ title: 'Solo task' })];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks).toHaveLength(1);
    expect(plan.batches[0].tasks[0].title).toBe('Solo task');
    expect(plan.batches[0].parallel).toBe(false);
    expect(plan.cycles).toEqual([]);
  });

  it('multiple independent tasks grouped into one parallel batch', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B' }),
      makeTask({ title: 'Task C' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks).toHaveLength(3);
    expect(plan.batches[0].parallel).toBe(true);
    expect(plan.cycles).toEqual([]);
  });

  it('tasks sorted by priority within batch (high before medium before low)', () => {
    const tasks = [
      makeTask({ title: 'Low task', priority: 'low' }),
      makeTask({ title: 'High task', priority: 'high' }),
      makeTask({ title: 'Medium task', priority: 'medium' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks[0].title).toBe('High task');
    expect(plan.batches[0].tasks[1].title).toBe('Medium task');
    expect(plan.batches[0].tasks[2].title).toBe('Low task');
  });

  it('dependent task placed in later batch', () => {
    const tasks = [
      makeTask({ title: 'Build app', priority: 'high' }),
      makeTask({ title: 'Run tests', priority: 'medium', dependsOn: ['Build app'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(2);
    expect(plan.batches[0].tasks[0].title).toBe('Build app');
    expect(plan.batches[1].tasks[0].title).toBe('Run tests');
  });

  it('chain of dependencies creates multiple batches', () => {
    const tasks = [
      makeTask({ title: 'Step 1', priority: 'high' }),
      makeTask({ title: 'Step 2', priority: 'high', dependsOn: ['Step 1'] }),
      makeTask({ title: 'Step 3', priority: 'high', dependsOn: ['Step 2'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(3);
    expect(plan.batches[0].tasks[0].title).toBe('Step 1');
    expect(plan.batches[1].tasks[0].title).toBe('Step 2');
    expect(plan.batches[2].tasks[0].title).toBe('Step 3');
  });

  it('already completed tasks excluded from plan', () => {
    const tasks = [
      makeTask({ title: 'Done task', status: 'completed' }),
      makeTask({ title: 'Pending task', status: 'pending' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks).toHaveLength(1);
    expect(plan.batches[0].tasks[0].title).toBe('Pending task');
  });

  it('all completed tasks returns empty plan', () => {
    const tasks = [
      makeTask({ title: 'Done 1', status: 'completed' }),
      makeTask({ title: 'Done 2', status: 'completed' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toEqual([]);
    expect(plan.cycles).toEqual([]);
  });

  it('failed tasks excluded from plan', () => {
    const tasks = [
      makeTask({ title: 'Failed task', status: 'failed' }),
      makeTask({ title: 'Pending task', status: 'pending' }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks[0].title).toBe('Pending task');
  });

  it('completed task satisfies dependency', () => {
    const tasks = [
      makeTask({ title: 'Build app', status: 'completed' }),
      makeTask({ title: 'Run tests', status: 'pending', dependsOn: ['Build app'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks[0].title).toBe('Run tests');
  });

  it('circular dependencies are detected instead of silently batched', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task B'] }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    // No batches since both tasks are in a cycle
    expect(plan.batches).toHaveLength(0);
    // Cycles should be detected
    expect(plan.cycles.length).toBeGreaterThan(0);
    // The cycle should contain both tasks
    const allCycleTitles = plan.cycles.flat();
    expect(allCycleTitles).toContain('Task A');
    expect(allCycleTitles).toContain('Task B');
  });

  it('unresolvable dependency on non-existent task is detected as stuck', () => {
    const tasks = [
      makeTask({ title: 'Orphan task', dependsOn: ['Non-existent task'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    // The task can't be scheduled (unmet dep on non-existent task)
    // No cycles among the remaining tasks (only one task, no internal cycle)
    expect(plan.cycles).toEqual([]);
    // The task is not in batches either since it has unmet deps
    expect(plan.batches).toHaveLength(0);
  });

  it('mix of independent and dependent tasks batched correctly', () => {
    const tasks = [
      makeTask({ title: 'Independent A', priority: 'high' }),
      makeTask({ title: 'Independent B', priority: 'low' }),
      makeTask({ title: 'Depends on A', priority: 'medium', dependsOn: ['Independent A'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(2);
    // First batch has both independent tasks
    expect(plan.batches[0].tasks).toHaveLength(2);
    expect(plan.batches[0].parallel).toBe(true);
    expect(plan.batches[0].tasks[0].title).toBe('Independent A');
    expect(plan.batches[0].tasks[1].title).toBe('Independent B');
    // Second batch has the dependent task
    expect(plan.batches[1].tasks).toHaveLength(1);
    expect(plan.batches[1].tasks[0].title).toBe('Depends on A');
    expect(plan.cycles).toEqual([]);
  });
});

describe('detectCycles', () => {
  it('simple 2-node cycle: A depends on B, B depends on A', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    const allTitles = cycles.flat();
    expect(allTitles).toContain('A');
    expect(allTitles).toContain('B');
  });

  it('3-node cycle: A -> B -> C -> A', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['C'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    const allTitles = cycles.flat();
    expect(allTitles).toContain('A');
    expect(allTitles).toContain('B');
    expect(allTitles).toContain('C');
  });

  it('mix of valid and cyclic tasks: valid tasks not in cycles', () => {
    const tasks = [
      makeTask({ title: 'Valid1' }),
      makeTask({ title: 'Valid2', dependsOn: ['Valid1'] }),
      makeTask({ title: 'CycleA', dependsOn: ['CycleB'] }),
      makeTask({ title: 'CycleB', dependsOn: ['CycleA'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    const allCycleTitles = cycles.flat();
    expect(allCycleTitles).toContain('CycleA');
    expect(allCycleTitles).toContain('CycleB');
    expect(allCycleTitles).not.toContain('Valid1');
    expect(allCycleTitles).not.toContain('Valid2');
  });

  it('no cycles returns empty array', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles).toEqual([]);
  });
});

describe('buildExecutionPlan with cycles', () => {
  it('valid tasks are batched, cyclic tasks are in cycles', () => {
    const tasks = [
      makeTask({ title: 'Setup', priority: 'high' }),
      makeTask({ title: 'Build', priority: 'medium', dependsOn: ['Setup'] }),
      makeTask({ title: 'CycleX', priority: 'low', dependsOn: ['CycleY'] }),
      makeTask({ title: 'CycleY', priority: 'low', dependsOn: ['CycleX'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    // Valid tasks should be in batches
    expect(plan.batches.length).toBeGreaterThanOrEqual(2);
    const batchedTitles = plan.batches.flatMap(b => b.tasks.map(t => t.title));
    expect(batchedTitles).toContain('Setup');
    expect(batchedTitles).toContain('Build');
    // Cyclic tasks should be detected
    expect(plan.cycles.length).toBeGreaterThan(0);
    const cycleTitles = plan.cycles.flat();
    expect(cycleTitles).toContain('CycleX');
    expect(cycleTitles).toContain('CycleY');
  });

  it('3-node cycle detected by buildExecutionPlan', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['C'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const plan = buildExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(0);
    expect(plan.cycles.length).toBeGreaterThan(0);
    const allCycleTitles = plan.cycles.flat();
    expect(allCycleTitles).toContain('A');
    expect(allCycleTitles).toContain('B');
    expect(allCycleTitles).toContain('C');
  });
});
