import { describe, it, expect } from 'vitest';
import { validateTasks } from './validator.js';
import type { Task } from './types.js';

/** Helper to create a minimal valid task with overrides. */
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

describe('validateTasks', () => {
  // ── happy path ──────────────────────────────────────────────

  it('returns valid result for an empty task array', () => {
    const result = validateTasks([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns valid result for a single well-formed task', () => {
    const result = validateTasks([makeTask({ title: 'Setup CI' })]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns valid result for multiple independent tasks', () => {
    const tasks = [
      makeTask({ title: 'Task A' }),
      makeTask({ title: 'Task B' }),
      makeTask({ title: 'Task C' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid result for tasks with valid dependency chain', () => {
    const tasks = [
      makeTask({ title: 'Build' }),
      makeTask({ title: 'Test', dependsOn: ['Build'] }),
      makeTask({ title: 'Deploy', dependsOn: ['Test'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // ── empty title ─────────────────────────────────────────────

  it('reports error for a task with empty title', () => {
    const result = validateTasks([makeTask({ title: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      severity: 'error',
      message: 'Task has an empty title',
    });
  });

  it('reports error for a task with whitespace-only title', () => {
    const result = validateTasks([makeTask({ title: '   ' })]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      severity: 'error',
      message: 'Task has an empty title',
    });
  });

  // ── duplicate titles ────────────────────────────────────────

  it('reports error for duplicate task titles', () => {
    const tasks = [
      makeTask({ title: 'Setup CI' }),
      makeTask({ title: 'Setup CI' }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      severity: 'error',
      message: 'Duplicate task title: "Setup CI"',
      taskTitle: 'Setup CI',
    });
  });

  it('reports one error per set of duplicates, not per occurrence', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'A' }),
      makeTask({ title: 'A' }),
    ];
    const result = validateTasks(tasks);
    const dupErrors = result.errors.filter((e) =>
      e.message.startsWith('Duplicate task title'),
    );
    expect(dupErrors).toHaveLength(1);
  });

  it('reports errors for multiple different duplicate titles', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
    ];
    const result = validateTasks(tasks);
    const dupErrors = result.errors.filter((e) =>
      e.message.startsWith('Duplicate task title'),
    );
    expect(dupErrors).toHaveLength(2);
    expect(dupErrors.map((e) => e.taskTitle).sort()).toEqual(['A', 'B']);
  });

  // ── non-existent dependencies (warning) ─────────────────────

  it('warns when a task depends on a non-existent task', () => {
    const tasks = [
      makeTask({ title: 'Deploy', dependsOn: ['Build'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true); // warnings don't affect validity
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual({
      severity: 'warning',
      message: 'Task "Deploy" depends on non-existent task "Build"',
      taskTitle: 'Deploy',
    });
  });

  it('warns for each non-existent dependency separately', () => {
    const tasks = [
      makeTask({ title: 'Deploy', dependsOn: ['Build', 'Lint'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].message).toContain('"Build"');
    expect(result.warnings[1].message).toContain('"Lint"');
  });

  it('does not warn for dependencies that exist', () => {
    const tasks = [
      makeTask({ title: 'Build' }),
      makeTask({ title: 'Deploy', dependsOn: ['Build'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.warnings).toHaveLength(0);
  });

  // ── circular dependencies ──────────────────────────────────

  it('detects a simple two-task cycle', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const cycleError = result.errors.find((e) =>
      e.message.startsWith('Circular dependency detected'),
    );
    expect(cycleError).toBeDefined();
    expect(cycleError!.message).toContain('A');
    expect(cycleError!.message).toContain('B');
    expect(cycleError!.message).toMatch(/→/);
  });

  it('detects a self-referencing task', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['A'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const cycleError = result.errors.find((e) =>
      e.message.startsWith('Circular dependency detected'),
    );
    expect(cycleError).toBeDefined();
    expect(cycleError!.message).toContain('A');
    expect(cycleError!.taskTitle).toBe('A');
  });

  it('detects a three-task cycle and returns the cycle path', () => {
    const tasks = [
      makeTask({ title: 'A', dependsOn: ['C'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
      makeTask({ title: 'C', dependsOn: ['B'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);
    const cycleError = result.errors.find((e) =>
      e.message.startsWith('Circular dependency detected'),
    );
    expect(cycleError).toBeDefined();
    // The cycle message should contain all three nodes and arrows
    expect(cycleError!.message).toMatch(/→.*→.*→/);
  });

  it('does not report false cycles for diamond dependencies', () => {
    // Diamond: A → B, A → C, B → D, C → D  (no cycle)
    const tasks = [
      makeTask({ title: 'D' }),
      makeTask({ title: 'B', dependsOn: ['D'] }),
      makeTask({ title: 'C', dependsOn: ['D'] }),
      makeTask({ title: 'A', dependsOn: ['B', 'C'] }),
    ];
    const result = validateTasks(tasks);
    const cycleErrors = result.errors.filter((e) =>
      e.message.startsWith('Circular dependency detected'),
    );
    expect(cycleErrors).toHaveLength(0);
  });

  // ── combined validations ────────────────────────────────────

  it('reports multiple error types simultaneously', () => {
    const tasks = [
      makeTask({ title: '' }),                           // empty title
      makeTask({ title: 'A', dependsOn: ['B'] }),        // B→A cycle
      makeTask({ title: 'B', dependsOn: ['A'] }),        // A→B cycle
      makeTask({ title: 'A' }),                           // duplicate "A"
      makeTask({ title: 'C', dependsOn: ['nonexistent'] }), // missing dep
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(false);

    const hasEmptyTitle = result.errors.some((e) =>
      e.message === 'Task has an empty title',
    );
    const hasDuplicate = result.errors.some((e) =>
      e.message.startsWith('Duplicate task title'),
    );
    const hasCycle = result.errors.some((e) =>
      e.message.startsWith('Circular dependency detected'),
    );
    const hasMissingDep = result.warnings.some((e) =>
      e.message.includes('non-existent task'),
    );

    expect(hasEmptyTitle).toBe(true);
    expect(hasDuplicate).toBe(true);
    expect(hasCycle).toBe(true);
    expect(hasMissingDep).toBe(true);
  });

  // ── immutability ────────────────────────────────────────────

  it('does not mutate the input tasks array', () => {
    const tasks: Task[] = [
      makeTask({ title: 'A', dependsOn: ['B'] }),
      makeTask({ title: 'B', dependsOn: ['A'] }),
    ];
    const tasksCopy = JSON.parse(JSON.stringify(tasks));
    validateTasks(tasks);
    expect(tasks).toEqual(tasksCopy);
  });

  // ── result shape ────────────────────────────────────────────

  it('valid is true when there are only warnings', () => {
    const tasks = [
      makeTask({ title: 'X', dependsOn: ['ghost'] }),
    ];
    const result = validateTasks(tasks);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('result contains only errors in errors and only warnings in warnings', () => {
    const tasks = [
      makeTask({ title: '' }),
      makeTask({ title: 'X', dependsOn: ['ghost'] }),
    ];
    const result = validateTasks(tasks);
    for (const issue of result.errors) {
      expect(issue.severity).toBe('error');
    }
    for (const issue of result.warnings) {
      expect(issue.severity).toBe('warning');
    }
  });
});
