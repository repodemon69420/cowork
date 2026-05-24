#!/usr/bin/env node
import { readFileContent, writeFileContent } from './fs-adapter.js';
import { parseTasksFile } from './parser.js';
import { serializeTasksFile } from './serializer.js';
import { buildExecutionPlan } from './scheduler.js';
import { validateTasks } from './validator.js';
import type { Task, ExecutionPlan } from './types.js';
import { fileURLToPath } from 'node:url';

export interface CliArgs {
  file: string;
  help: boolean;
  validate: boolean;
  markDone?: string;
}

export function parseArgs(args: string[]): CliArgs {
  let file = 'TASKS.md';
  let help = false;
  let validate = false;
  let markDone: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      help = true;
    } else if (args[i] === '--validate') {
      validate = true;
    } else if (args[i] === '--file' && i + 1 < args.length) {
      file = args[++i];
    } else if (args[i] === '--mark-done' && i + 1 < args.length) {
      markDone = args[++i];
    }
  }
  return { file, help, validate, markDone };
}

export function formatPlan(tasks: Task[], plan: ExecutionPlan): string {
  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const lines: string[] = [
    `Total tasks: ${tasks.length}`,
    `  Pending: ${pending}  Completed: ${completed}  Failed: ${failed}`,
    '',
    'Execution Plan:',
  ];
  for (let i = 0; i < plan.batches.length; i++) {
    const batch = plan.batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    const titles = batch.tasks.map(t => t.title).join(', ');
    lines.push(`  Batch ${i + 1} (${mode}): ${titles}`);
  }
  if (plan.cycles.length > 0) {
    lines.push('');
    lines.push('WARNING: Dependency cycles detected:');
    for (const cycle of plan.cycles) {
      lines.push(`  Cycle: ${cycle.join(' -> ')}`);
    }
  }
  return lines.join('\n');
}

const USAGE = `Usage: cowork [options]

Options:
  --file <path>        Path to tasks file (default: TASKS.md)
  --mark-done <title>  Mark a task as completed
  --validate           Validate the tasks file
  --help, -h           Show this help message`;

export function main(): void {
  const cliArgs = parseArgs(process.argv.slice(2));
  if (cliArgs.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (cliArgs.validate) {
    try {
      const content = readFileContent(cliArgs.file);
      const tasks = parseTasksFile(content);
      const result = validateTasks(tasks);
      for (const issue of result.issues) {
        const tag = issue.level === 'error' ? 'ERROR' : 'WARNING';
        console.log(`${tag}: ${issue.message} (task: ${issue.taskTitle})`);
      }
      const errors = result.issues.filter(i => i.level === 'error').length;
      const warnings = result.issues.length - errors;
      if (errors > 0) {
        console.log(`Validation: FAIL (${errors} errors, ${warnings} warnings)`);
        process.exit(1);
      } else {
        console.log('Validation: PASS');
      }
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  }
  try {
    const content = readFileContent(cliArgs.file);
    const tasks = parseTasksFile(content);
    if (cliArgs.markDone) {
      const task = tasks.find(t => t.title === cliArgs.markDone);
      if (!task) {
        console.error(`Error: Task not found: ${cliArgs.markDone}`);
        process.exit(1);
      }
      if (task.status === 'completed') {
        console.error(`Error: Task already completed: ${cliArgs.markDone}`);
        process.exit(1);
      }
      task.status = 'completed';
      writeFileContent(cliArgs.file, serializeTasksFile(tasks));
      console.log(`Marked done: ${cliArgs.markDone}`);
      return;
    }
    const plan = buildExecutionPlan(tasks);
    console.log(formatPlan(tasks, plan));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main();
}
