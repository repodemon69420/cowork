import { describe, it, expect } from 'vitest';
import { validateTasks, detectCycles, ValidationResult } from './validator.js';
import { Task } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Default task',
    priority: 'medium',
    type: 'code',
    context: 'Some context',
    status: 'pending',
    ...overrides,
  };
}

describe('validateTasks', () => {
  it('returns valid for tasks with no issues', () => {
    const tasks = [
      makeTask({ title: 'Task A', context: 'Context A' }),
      makeTask({ title: 'Task B', context: 'Context B' }),
    ];
    const result = validateTasks(tasks);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('detects duplicate titles (exact match)', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task A' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    const dupError = result.errors.find(e => e.field === 'title' && e.message.toLowerCase().includes('duplicate'));
    expect(dupError).toBeDefined();
    expect(dupError!.task).toBe('Task A');
  });

  it('detects duplicate titles (case-insensitive)', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'task a' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const dupError = result.errors.find(e => e.field === 'title' && e.message.toLowerCase().includes('duplicate'));
    expect(dupError).toBeDefined();
  });

  it('detects empty title', () => {
    const tasks = [
      makeTask({ title: '' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const emptyTitleError = result.errors.find(e => e.field === 'title' && e.message.toLowerCase().includes('empty'));
    expect(emptyTitleError).toBeDefined();
  });

  it('detects empty context', () => {
    const tasks = [
      makeTask({ title: 'Task A', context: '' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const emptyContextError = result.errors.find(e => e.field === 'context' && e.message.toLowerCase().includes('empty'));
    expect(emptyContextError).toBeDefined();
    expect(emptyContextError!.task).toBe('Task A');
  });

  it('detects dependency on non-existent task', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Non-existent'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const depError = result.errors.find(e => e.field === 'dependsOn' && e.message.includes('Non-existent'));
    expect(depError).toBeDefined();
    expect(depError!.task).toBe('Task A');
  });

  it('detects self-dependency', () => {
    const tasks = [
      makeTask({ title: 'Task A', dependsOn: ['Task A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const selfDepError = result.errors.find(e => e.field === 'dependsOn' && e.message.toLowerCase().includes('self'));
    expect(selfDepError).toBeDefined();
    expect(selfDepError!.task).toBe('Task A');
  });

  it('reports multiple errors together', () => {
    const tasks = [
      makeTask({ title: '', context: '' }),
      makeTask({ title: 'Task B', dependsOn: ['Ghost'] }),
      makeTask({ title: 'Task B' }), // duplicate
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    // At minimum: empty title, empty context, missing dep, duplicate title
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('returns valid for empty task array', () => {
    const result = validateTasks([]);
    expect(result).toEqual({ valid: true, errors: [] });
  });
});

describe('detectCycles', () => {
  it('returns empty array when no cycles', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    expect(detectCycles(tasks)).toEqual([]);
  });

  it('detects simple cycle: A -> B -> A', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    // At least one cycle should contain both A and B
    const hasABCycle = cycles.some(
      c => c.includes('A') && c.includes('B')
    );
    expect(hasABCycle).toBe(true);
  });

  it('detects three-node cycle: A -> B -> C -> A', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['C'] }),
      makeTask({ title: 'C', dependsOn: ['A'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const hasABCCycle = cycles.some(
      c => c.includes('A') && c.includes('B') && c.includes('C')
    );
    expect(hasABCCycle).toBe(true);
  });

  it('detects multiple independent cycles', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['D'] }),
      makeTask({ title: 'D', dependsOn: ['C'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for chain with no cycle (A -> B -> C)', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['C'] }),
      makeTask({ title: 'C' }),
    ];
    expect(detectCycles(tasks)).toEqual([]);
  });

  it('detects self-referencing task (A -> A)', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['A'] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const hasSelfCycle = cycles.some(
      c => c.length === 2 && c[0] === 'A' && c[1] === 'A'
    );
    expect(hasSelfCycle).toBe(true);
  });

  it('returns empty for tasks with no dependencies', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
      makeTask({ title: 'C' }),
    ];
    expect(detectCycles(tasks)).toEqual([]);
  });
});
