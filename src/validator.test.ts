import { describe, it, expect } from 'vitest';
import { validateTasks } from './validator.js';
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
  it('returns valid for a correct task list', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B', dependsOn: ['Task A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('returns valid for an empty task list', () => {
    const result = validateTasks([]);
    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('warns on missing context', () => {
    const tasks = [makeTask({ title: 'No context', context: '' })];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toEqual({
      severity: 'warning',
      message: 'Task has no context. Add a description so the agent knows what to do.',
      taskTitle: 'No context',
    });
  });

  it('errors on duplicate titles', () => {
    const tasks = [
      makeTask({ title: 'Duplicate' }),
      makeTask({ title: 'Duplicate' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual({
      severity: 'error',
      message: 'Duplicate task title "Duplicate". Each task must have a unique title.',
      taskTitle: 'Duplicate',
    });
  });

  it('errors on unknown dependency reference', () => {
    const tasks = [
      makeTask({ title: 'Lonely', dependsOn: ['Ghost'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual({
      severity: 'error',
      message: 'Depends on "Ghost" which does not exist. Check for typos or add the missing task.',
      taskTitle: 'Lonely',
    });
  });

  it('errors on self-dependency', () => {
    const tasks = [
      makeTask({ title: 'Narcissist', dependsOn: ['Narcissist'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual({
      severity: 'error',
      message: 'Task depends on itself. Remove "Narcissist" from dependsOn.',
      taskTitle: 'Narcissist',
    });
  });

  it('errors on circular dependency (A→B→A)', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const cycleErrors = result.diagnostics.filter(
      d => d.severity === 'error' && d.message.includes('Circular dependency'),
    );
    expect(cycleErrors.length).toBeGreaterThan(0);
  });

  it('errors on longer cycle (A→B→C→A)', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['C'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const cycleErrors = result.diagnostics.filter(
      d => d.severity === 'error' && d.message.includes('Circular dependency'),
    );
    expect(cycleErrors.length).toBeGreaterThan(0);
  });

  it('returns multiple diagnostics when several issues exist', () => {
    const tasks = [
      makeTask({ title: 'Dup', context: '' }),
      makeTask({ title: 'Dup', dependsOn: ['Nonexistent'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);

    const severities = result.diagnostics.map(d => d.severity);
    expect(severities).toContain('warning');
    expect(severities).toContain('error');
  });

  it('warnings alone keep valid as true', () => {
    const tasks = [
      makeTask({ title: 'A', context: '' }),
      makeTask({ title: 'B', context: '' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.every(d => d.severity === 'warning')).toBe(true);
  });
});
