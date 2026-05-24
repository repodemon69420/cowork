import { describe, it, expect } from 'vitest';
import { validateTasks } from './validator.js';
import { Task } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Task A',
    priority: 'medium',
    type: 'code',
    context: 'some context',
    status: 'pending',
    ...overrides,
  };
}

describe('validateTasks', () => {
  it('returns valid for correct tasks with no issues', () => {
    const result = validateTasks([
      makeTask({ title: 'A' }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects duplicate titles', () => {
    const result = validateTasks([
      makeTask({ title: 'Dup' }),
      makeTask({ title: 'Dup' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', taskTitle: 'Dup' }),
    );
  });

  it('detects missing dependency', () => {
    const result = validateTasks([
      makeTask({ title: 'A', dependsOn: ['NonExistent'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing dependency: "NonExistent"' }),
    );
  });

  it('detects self-dependency', () => {
    const result = validateTasks([
      makeTask({ title: 'A', dependsOn: ['A'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Task depends on itself' }),
    );
  });

  it('warns on empty title', () => {
    const result = validateTasks([makeTask({ title: '' })]);
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', message: 'Task has empty title' }),
    );
  });

  it('warns on empty context', () => {
    const result = validateTasks([makeTask({ title: 'A', context: '' })]);
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', message: 'Task has empty context' }),
    );
  });

  it('reports multiple issues at once', () => {
    const result = validateTasks([
      makeTask({ title: 'A', context: '', dependsOn: ['A'] }),
      makeTask({ title: 'A', dependsOn: ['Missing'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('returns valid with no issues for empty array', () => {
    const result = validateTasks([]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
