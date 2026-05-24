#!/usr/bin/env node
import { readFileContent } from './fs-adapter.js';
import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import type { Task, ExecutionPlan } from './types.js';
import { fileURLToPath } from 'node:url';

export interface CliArgs {
  file: string;
  help: boolean;
}

export function parseArgs(args: string[]): CliArgs {
  let file = 'TASKS.md';
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      help = true;
    } else if (args[i] === '--file' && i + 1 < args.length) {
      file = args[++i];
    }
  }
  return { file, help };
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
  --file <path>  Path to tasks file (default: TASKS.md)
  --help, -h     Show this help message`;

export function main(): void {
  const cliArgs = parseArgs(process.argv.slice(2));
  if (cliArgs.help) {
    console.log(USAGE);
    process.exit(0);
  }
  try {
    const content = readFileContent(cliArgs.file);
    const tasks = parseTasksFile(content);
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
