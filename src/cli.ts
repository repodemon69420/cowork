#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { validateTasks } from './validator.js';
import { TaskStatus } from './types.js';

const USAGE = `Usage: cowork <command>

Commands:
  status    Show task counts by status
  plan      Show the execution plan
  validate  Validate tasks for issues`;

const STATUS_LABELS: readonly TaskStatus[] = ['pending', 'completed', 'failed', 'skipped'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function padLabel(label: string, width: number): string {
  return label + ':' + ' '.repeat(Math.max(0, width - label.length));
}

function formatStatus(tasksContent: string): string {
  const tasks = parseTasksFile(tasksContent);

  const counts: Record<string, number> = {};
  for (const status of STATUS_LABELS) {
    counts[status] = 0;
  }
  for (const task of tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  const maxLabelLen = Math.max(...STATUS_LABELS.map(s => capitalize(s).length));
  const lines = STATUS_LABELS.map(
    status => `  ${padLabel(capitalize(status), maxLabelLen)} ${counts[status]}`
  );
  lines.push(`  ${'Total:'.padEnd(maxLabelLen + 1)} ${tasks.length}`);

  return `Task Status:\n${lines.join('\n')}`;
}

function formatPlan(tasksContent: string): string {
  const tasks = parseTasksFile(tasksContent);
  const batches = buildExecutionPlan(tasks);

  if (batches.length === 0) {
    return 'No pending tasks to plan.';
  }

  const batchLines = batches.map((batch, i) => {
    const mode = batch.parallel ? 'parallel' : 'sequential';
    const header = `  Batch ${i + 1} (${mode}):`;
    const taskLines = batch.tasks.map(task => {
      const deps = task.dependsOn && task.dependsOn.length > 0
        ? ` (depends on: ${task.dependsOn.join(', ')})`
        : '';
      return `    - [${task.priority}] ${task.title}${deps}`;
    });
    return [header, ...taskLines].join('\n');
  });

  return `Execution Plan:\n${batchLines.join('\n')}`;
}

function formatValidation(tasksContent: string): string {
  const tasks = parseTasksFile(tasksContent);
  const result = validateTasks(tasks);

  if (result.errors.length === 0 && result.warnings.length === 0) {
    return 'Validation passed — no issues found.';
  }

  const sections: string[] = [];

  if (result.errors.length > 0) {
    const header = `  Errors (${result.errors.length}):`;
    const items = result.errors.map(
      e => `    - [${e.type}] ${e.message}`
    );
    sections.push([header, ...items].join('\n'));
  }

  if (result.warnings.length > 0) {
    const header = `  Warnings (${result.warnings.length}):`;
    const items = result.warnings.map(
      w => `    - [${w.type}] ${w.message}`
    );
    sections.push([header, ...items].join('\n'));
  }

  return `Validation Results:\n${sections.join('\n')}`;
}

export function run(args: string[], tasksContent?: string): string {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0];
  const content = tasksContent ?? '';

  switch (command) {
    case 'status':
      return formatStatus(content);
    case 'plan':
      return formatPlan(content);
    case 'validate':
      return formatValidation(content);
    default:
      return USAGE;
  }
}

export function main(): void {
  try {
    const args = process.argv.slice(2);
    const tasksContent = readFileSync('TASKS.md', 'utf-8');
    const output = run(args, tasksContent);
    process.stdout.write(output + '\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
