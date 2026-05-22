import { describe, it, expect } from 'vitest';
import { validateTasks } from './validator.js';
import { Task } from './types.js';

function makeTask(overrides: Partial<Task> & { title: string }): Task {
  return {
    priority: 'medium',
    type: 'code',
    context: 'Some context',
    status: 'pending',
    ...overrides,
  };
}

describe('validateTasks', () => {
  it('returns no errors or warnings for an empty array', () => {
    const result = validateTasks([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns no errors for valid tasks with no issues', () => {
    const tasks: Task[] = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('detects duplicate titles', () => {
    const tasks: Task[] = [
      makeTask({ title: 'Duplicate' }),
      makeTask({ title: 'Duplicate' }),
    ];
    const result = validateTasks(tasks);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('duplicate-title');
    expect(result.errors[0].taskTitle).toBe('Duplicate');
    expect(result.errors[0].message).toContain('Duplicate');
  });

  it('detects circular dependencies between two tasks', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const result = validateTasks(tasks);
    const circularErrors = result.errors.filter(
      (e) => e.type === 'circular-dependency',
    );
    expect(circularErrors.length).toBeGreaterThanOrEqual(1);
    expect(circularErrors[0].message).toMatch(/circular/i);
  });

  it('detects circular dependencies in a 3-node cycle', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A', dependsOn: ['C'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const result = validateTasks(tasks);
    const circularErrors = result.errors.filter(
      (e) => e.type === 'circular-dependency',
    );
    expect(circularErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('detects missing dependency references', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A', dependsOn: ['Nonexistent'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('missing-dependency');
    expect(result.errors[0].taskTitle).toBe('A');
    expect(result.errors[0].message).toContain('Nonexistent');
  });

  it('detects empty title', () => {
    const tasks: Task[] = [makeTask({ title: '' })];
    const result = validateTasks(tasks);
    const emptyTitleErrors = result.errors.filter(
      (e) => e.type === 'empty-title',
    );
    expect(emptyTitleErrors).toHaveLength(1);
  });

  it('detects whitespace-only title', () => {
    const tasks: Task[] = [makeTask({ title: '   ' })];
    const result = validateTasks(tasks);
    const emptyTitleErrors = result.errors.filter(
      (e) => e.type === 'empty-title',
    );
    expect(emptyTitleErrors).toHaveLength(1);
  });

  it('detects self-dependency', () => {
    const tasks: Task[] = [makeTask({ title: 'A', dependsOn: ['A'] })];
    const result = validateTasks(tasks);
    const selfDepErrors = result.errors.filter(
      (e) => e.type === 'self-dependency',
    );
    expect(selfDepErrors).toHaveLength(1);
    expect(selfDepErrors[0].taskTitle).toBe('A');
  });

  it('warns when a completed task has pending dependencies', () => {
    const tasks: Task[] = [
      makeTask({ title: 'Dep', status: 'pending' }),
      makeTask({ title: 'Done', status: 'completed', dependsOn: ['Dep'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('completed-with-pending-dep');
    expect(result.warnings[0].taskTitle).toBe('Done');
    expect(result.warnings[0].message).toContain('Dep');
  });

  it('detects multiple issues at once', () => {
    const tasks: Task[] = [
      makeTask({ title: '' }),
      makeTask({ title: 'Dup' }),
      makeTask({ title: 'Dup' }),
      makeTask({ title: 'Self', dependsOn: ['Self'] }),
      makeTask({ title: 'Missing', dependsOn: ['Ghost'] }),
    ];
    const result = validateTasks(tasks);
    const types = result.errors.map((e) => e.type);
    expect(types).toContain('empty-title');
    expect(types).toContain('duplicate-title');
    expect(types).toContain('self-dependency');
    expect(types).toContain('missing-dependency');
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('does not report false positives on valid dependency chains', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
      makeTask({ title: 'D', dependsOn: ['A', 'C'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('does not warn when completed task depends on another completed task', () => {
    const tasks: Task[] = [
      makeTask({ title: 'Dep', status: 'completed' }),
      makeTask({ title: 'Done', status: 'completed', dependsOn: ['Dep'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.warnings).toEqual([]);
  });

  it('does not report circular dependency for a valid DAG', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['A'] }),
      makeTask({ title: 'D', dependsOn: ['B', 'C'] }),
    ];
    const result = validateTasks(tasks);
    const circularErrors = result.errors.filter(
      (e) => e.type === 'circular-dependency',
    );
    expect(circularErrors).toEqual([]);
  });
});
