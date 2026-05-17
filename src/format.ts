import type { Task, ExecutionBatch } from './types.js';
import type { ValidationResult } from './validator.js';

/**
 * Formats validation errors and warnings for terminal output.
 * Returns empty string if there are no issues.
 */
export function formatValidationIssues(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const issue of result.errors) {
      lines.push(`  ERROR: ${issue.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Warnings:');
    for (const issue of result.warnings) {
      lines.push(`  WARNING: ${issue.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats the execution plan showing batch numbers,
 * parallel/sequential mode, and task titles with priorities.
 */
export function formatExecutionPlan(batches: ReadonlyArray<ExecutionBatch>): string {
  if (batches.length === 0) {
    return 'No tasks to execute.';
  }

  const lines: string[] = [];
  lines.push('Execution Plan:');
  lines.push('');

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    lines.push(`  Batch ${i + 1} (${mode}):`);

    for (const task of batch.tasks) {
      lines.push(`    - [${task.priority}] ${task.title}`);
    }

    if (i < batches.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Top-level summary: total tasks, pending, completed, failed,
 * number of batches.
 */
export function formatSummary(
  tasks: ReadonlyArray<Task>,
  batches: ReadonlyArray<ExecutionBatch>,
): string {
  const total = tasks.length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const skipped = tasks.filter((t) => t.status === 'skipped').length;

  const lines: string[] = [];
  lines.push('Summary:');
  lines.push(`  Total tasks: ${total}`);
  lines.push(`  - pending:   ${pending}`);
  lines.push(`  - completed: ${completed}`);
  lines.push(`  - failed:    ${failed}`);
  lines.push(`  - skipped:   ${skipped}`);
  lines.push(`  Execution batches: ${batches.length}`);

  return lines.join('\n');
}
