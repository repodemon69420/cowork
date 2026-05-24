#!/usr/bin/env node
import { readFileContent, writeFileContent } from './fs-adapter.js';
import { parseTasksFile } from './parser.js';
import { serializeTasksFile } from './serializer.js';
import { buildExecutionPlan, detectCycles } from './scheduler.js';
import { validateTasks } from './validator.js';
import { getCurrentBranch, getLatestCommitHash, hasUncommittedChanges } from './git-adapter.js';
import type { Task, ExecutionPlan } from './types.js';
import { fileURLToPath } from 'node:url';

export interface CliArgs {
  file: string;
  help: boolean;
  validate: boolean;
  status: boolean;
  markDone?: string;
}

export function parseArgs(args: string[]): CliArgs {
  let file = 'TASKS.md', help = false, validate = false, status = false;
  let markDone: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') help = true;
    else if (args[i] === '--validate') validate = true;
    else if (args[i] === '--status') status = true;
    else if (args[i] === '--file' && i + 1 < args.length) file = args[++i];
    else if (args[i] === '--mark-done' && i + 1 < args.length) markDone = args[++i];
  }
  return { file, help, validate, status, markDone };
}

export function formatPlan(tasks: Task[], plan: ExecutionPlan): string {
  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const lines: string[] = [
    `Total tasks: ${tasks.length}`,
    `  Pending: ${pending}  Completed: ${completed}  Failed: ${failed}`,
    '', 'Execution Plan:',
  ];
  for (let i = 0; i < plan.batches.length; i++) {
    const batch = plan.batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    lines.push(`  Batch ${i + 1} (${mode}): ${batch.tasks.map(t => t.title).join(', ')}`);
  }
  if (plan.cycles.length > 0) {
    lines.push('', 'WARNING: Dependency cycles detected:');
    for (const cycle of plan.cycles) lines.push(`  Cycle: ${cycle.join(' -> ')}`);
  }
  return lines.join('\n');
}

const USAGE = `Usage: cowork [options]

Options:
  --file <path>        Path to tasks file (default: TASKS.md)
  --mark-done <title>  Mark a task as completed
  --status             Show project and task status
  --validate           Validate the tasks file
  --help, -h           Show this help message`;

function fail(msg: string): never { console.error(`Error: ${msg}`); process.exit(1); }

export function main(): void {
  const cliArgs = parseArgs(process.argv.slice(2));
  if (cliArgs.help) { console.log(USAGE); process.exit(0); }
  if (cliArgs.status) {
    try {
      const tasks = parseTasksFile(readFileContent(cliArgs.file));
      const p = tasks.filter(t => t.status === 'pending').length;
      const c = tasks.filter(t => t.status === 'completed').length;
      const f = tasks.filter(t => t.status === 'failed').length;
      console.log('Cowork Status');
      console.log(`Branch: ${getCurrentBranch()}`);
      console.log(`Last commit: ${getLatestCommitHash()}`);
      console.log(`Uncommitted changes: ${hasUncommittedChanges() ? 'yes' : 'no'}`);
      console.log(`Tasks: ${p} pending, ${c} completed, ${f} failed (${tasks.length} total)`);
      process.exit(0);
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }
  if (cliArgs.validate) {
    try {
      const tasks = parseTasksFile(readFileContent(cliArgs.file));
      const result = validateTasks(tasks);
      for (const issue of result.issues) {
        const tag = issue.level === 'error' ? 'ERROR' : 'WARNING';
        console.log(`${tag}: ${issue.message} (task: ${issue.taskTitle})`);
      }
      const cycles = detectCycles(tasks);
      for (const cycle of cycles) {
        console.log(`ERROR: Dependency cycle detected: ${[...cycle, cycle[0]].join(' -> ')} (task: ${cycle[0]})`);
      }
      const errors = result.issues.filter(i => i.level === 'error').length + cycles.length;
      const warnings = result.issues.length - result.issues.filter(i => i.level === 'error').length;
      if (errors > 0) { console.log(`Validation: FAIL (${errors} errors, ${warnings} warnings)`); process.exit(1); }
      else { console.log('Validation: PASS'); }
      return;
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }
  try {
    const tasks = parseTasksFile(readFileContent(cliArgs.file));
    if (cliArgs.markDone) {
      const task = tasks.find(t => t.title === cliArgs.markDone);
      if (!task) fail(`Task not found: ${cliArgs.markDone}`);
      if (task.status === 'completed') fail(`Task already completed: ${cliArgs.markDone}`);
      task.status = 'completed';
      writeFileContent(cliArgs.file, serializeTasksFile(tasks));
      console.log(`Marked done: ${cliArgs.markDone}`);
      return;
    }
    console.log(formatPlan(tasks, buildExecutionPlan(tasks)));
  } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
}
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) { main(); }
