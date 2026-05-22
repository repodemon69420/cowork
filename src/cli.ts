#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { validateTasks } from './validator.js';
import { checkKillSwitch } from './killswitch.js';
import { runSession } from './runner.js';
import { generateReport } from './reporter.js';
import { TaskStatus, TaskPriority, TaskType, Task } from './types.js';
import { serializeTask } from './writer.js';

export interface RunResult {
  output: string;
  exitCode: number;
}

const USAGE = `Usage: cowork <command>

Commands:
  status    Show task counts by status
  plan      Show the execution plan
  validate  Validate tasks for issues
  run       Run a session (parse, validate, plan, execute, report)
  add       Generate a new task block`;

const STATUS_LABELS: readonly TaskStatus[] = ['pending', 'completed', 'failed', 'skipped'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function padLabel(label: string, width: number): string {
  return label + ':' + ' '.repeat(Math.max(0, width - label.length));
}

function formatStatus(tasksContent: string, json: boolean): RunResult {
  const tasks = parseTasksFile(tasksContent);

  const counts: Record<string, number> = {};
  for (const status of STATUS_LABELS) {
    counts[status] = 0;
  }
  for (const task of tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  if (json) {
    const data = { ...counts, total: tasks.length };
    return { output: JSON.stringify(data, null, 2), exitCode: 0 };
  }

  const maxLabelLen = Math.max(...STATUS_LABELS.map(s => capitalize(s).length));
  const lines = STATUS_LABELS.map(
    status => `  ${padLabel(capitalize(status), maxLabelLen)} ${counts[status]}`
  );
  lines.push(`  ${'Total:'.padEnd(maxLabelLen + 1)} ${tasks.length}`);

  return { output: `Task Status:\n${lines.join('\n')}`, exitCode: 0 };
}

function formatPlan(tasksContent: string, json: boolean): RunResult {
  const tasks = parseTasksFile(tasksContent);
  const batches = buildExecutionPlan(tasks);

  if (json) {
    const data = batches.map((batch, i) => ({
      batch: i + 1,
      parallel: batch.parallel,
      tasks: batch.tasks.map(task => ({
        title: task.title,
        priority: task.priority,
      })),
    }));
    return { output: JSON.stringify(data, null, 2), exitCode: 0 };
  }

  if (batches.length === 0) {
    return { output: 'No pending tasks to plan.', exitCode: 0 };
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

  return { output: `Execution Plan:\n${batchLines.join('\n')}`, exitCode: 0 };
}

function formatValidation(tasksContent: string, json: boolean): RunResult {
  const tasks = parseTasksFile(tasksContent);
  const result = validateTasks(tasks);
  const exitCode = result.errors.length > 0 ? 1 : 0;

  if (json) {
    return { output: JSON.stringify(result, null, 2), exitCode };
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    return { output: 'Validation passed — no issues found.', exitCode: 0 };
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

  return { output: `Validation Results:\n${sections.join('\n')}`, exitCode };
}

function formatRun(tasksContent: string, json: boolean): RunResult {
  const killSwitch = checkKillSwitch(tasksContent);

  if (!killSwitch.active) {
    const reason = killSwitch.reason ?? 'Kill switch is OFF';
    if (json) {
      return { output: JSON.stringify({ aborted: true, reason }, null, 2), exitCode: 0 };
    }
    return { output: 'Kill switch is OFF — session aborted.', exitCode: 0 };
  }

  const tasks = parseTasksFile(tasksContent);

  const validation = validateTasks(tasks);
  if (validation.errors.length > 0) {
    return formatValidation(tasksContent, json);
  }

  const result = runSession(tasks);
  const report = generateReport(result, []);

  if (json) {
    return { output: JSON.stringify(result, null, 2), exitCode: 0 };
  }

  return { output: report, exitCode: 0 };
}

function formatAdd(positionals: string[], values: Record<string, unknown>, json: boolean): RunResult {
  const title = positionals[1];
  if (!title) {
    return { output: 'Usage: cowork add "Task title" [--priority high] [--type code] [--context "..."]', exitCode: 1 };
  }

  const task: Task = {
    title,
    priority: (values.priority as TaskPriority) || 'medium',
    type: (values.type as TaskType) || 'code',
    context: (values.context as string) || '',
    status: 'pending',
  };

  if (json) {
    return { output: JSON.stringify(task, null, 2), exitCode: 0 };
  }

  return { output: serializeTask(task), exitCode: 0 };
}

export function run(args: string[], tasksContent?: string): RunResult {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    strict: false,
    options: {
      json: { type: 'boolean', default: false },
      priority: { type: 'string', short: 'p' },
      type: { type: 'string', short: 't' },
      context: { type: 'string', short: 'c' },
    },
  });

  const command = positionals[0];
  const content = tasksContent ?? '';
  const json = values.json as boolean;

  switch (command) {
    case 'status':
      return formatStatus(content, json);
    case 'plan':
      return formatPlan(content, json);
    case 'validate':
      return formatValidation(content, json);
    case 'run':
      return formatRun(content, json);
    case 'add':
      return formatAdd(positionals, values, json);
    default:
      return { output: USAGE, exitCode: 0 };
  }
}

export function main(): void {
  try {
    const args = process.argv.slice(2);
    const tasksContent = readFileSync('TASKS.md', 'utf-8');
    const result = run(args, tasksContent);
    process.stdout.write(result.output + '\n');
    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
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
