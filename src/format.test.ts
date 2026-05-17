import { describe, it, expect } from 'vitest';
import { formatValidationIssues, formatExecutionPlan, formatSummary } from './format.js';
import type { Task, ExecutionBatch } from './types.js';
import type { ValidationResult } from './validator.js';

describe('formatValidationIssues', () => {
  it('returns empty string when no errors and no warnings', () => {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    expect(formatValidationIssues(result)).toBe('');
  });

  it('formats errors', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        { severity: 'error', message: 'Duplicate task title: "foo"', taskTitle: 'foo' },
      ],
      warnings: [],
    };
    const output = formatValidationIssues(result);
    expect(output).toContain('ERROR');
    expect(output).toContain('Duplicate task title: "foo"');
  });

  it('formats warnings', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [
        { severity: 'warning', message: 'Task "B" depends on non-existent task "X"', taskTitle: 'B' },
      ],
    };
    const output = formatValidationIssues(result);
    expect(output).toContain('WARNING');
    expect(output).toContain('Task "B" depends on non-existent task "X"');
  });

  it('formats both errors and warnings', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        { severity: 'error', message: 'Circular dependency detected: A -> B -> A', taskTitle: 'A' },
      ],
      warnings: [
        { severity: 'warning', message: 'Task "C" depends on non-existent task "Z"', taskTitle: 'C' },
      ],
    };
    const output = formatValidationIssues(result);
    expect(output).toContain('ERROR');
    expect(output).toContain('WARNING');
    expect(output).toContain('Circular dependency');
    expect(output).toContain('non-existent task "Z"');
  });
});

describe('formatExecutionPlan', () => {
  it('returns message when no batches', () => {
    const output = formatExecutionPlan([]);
    expect(output).toContain('No tasks');
  });

  it('formats a single batch with one task', () => {
    const task: Task = {
      title: 'Setup CI',
      priority: 'high',
      type: 'code',
      context: '',
      status: 'pending',
    };
    const batches: ExecutionBatch[] = [{ tasks: [task], parallel: false }];
    const output = formatExecutionPlan(batches);
    expect(output).toContain('Batch 1');
    expect(output).toContain('sequential');
    expect(output).toContain('Setup CI');
    expect(output).toContain('high');
  });

  it('formats multiple batches with parallel indication', () => {
    const taskA: Task = {
      title: 'Task A',
      priority: 'high',
      type: 'code',
      context: '',
      status: 'pending',
    };
    const taskB: Task = {
      title: 'Task B',
      priority: 'medium',
      type: 'test',
      context: '',
      status: 'pending',
    };
    const taskC: Task = {
      title: 'Task C',
      priority: 'low',
      type: 'docs',
      context: '',
      status: 'pending',
      dependsOn: ['Task A', 'Task B'],
    };
    const batches: ExecutionBatch[] = [
      { tasks: [taskA, taskB], parallel: true },
      { tasks: [taskC], parallel: false },
    ];
    const output = formatExecutionPlan(batches);
    expect(output).toContain('Batch 1');
    expect(output).toContain('parallel');
    expect(output).toContain('Task A');
    expect(output).toContain('Task B');
    expect(output).toContain('Batch 2');
    expect(output).toContain('sequential');
    expect(output).toContain('Task C');
  });
});

describe('formatSummary', () => {
  it('formats summary with all statuses', () => {
    const tasks: Task[] = [
      { title: 'A', priority: 'high', type: 'code', context: '', status: 'pending' },
      { title: 'B', priority: 'medium', type: 'test', context: '', status: 'completed' },
      { title: 'C', priority: 'low', type: 'docs', context: '', status: 'failed' },
      { title: 'D', priority: 'high', type: 'code', context: '', status: 'skipped' },
    ];
    const batches: ExecutionBatch[] = [
      { tasks: [tasks[0]], parallel: false },
    ];
    const output = formatSummary(tasks, batches);
    expect(output).toContain('4');   // total
    expect(output).toContain('1');   // pending count or batch count
    expect(output).toContain('pending');
    expect(output).toContain('completed');
    expect(output).toContain('failed');
  });

  it('formats summary with zero tasks', () => {
    const output = formatSummary([], []);
    expect(output).toContain('0');
  });

  it('includes batch count', () => {
    const tasks: Task[] = [
      { title: 'A', priority: 'high', type: 'code', context: '', status: 'pending' },
      { title: 'B', priority: 'medium', type: 'test', context: '', status: 'pending' },
    ];
    const batches: ExecutionBatch[] = [
      { tasks: [tasks[0], tasks[1]], parallel: true },
    ];
    const output = formatSummary(tasks, batches);
    expect(output).toContain('2');  // total tasks
    expect(output).toContain('1');  // batch count
    expect(output).toContain('batch');
  });
});
