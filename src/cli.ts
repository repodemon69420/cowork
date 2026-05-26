import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport } from './reporter.js';
import { readFile, writeFile } from './io.js';
import { validateTasks, detectCycles } from './validator.js';
import { executePlan } from './executor.js';
import { updateTaskStatus } from './writer.js';
import type { TaskRunner } from './executor.js';
import type { ExecutionBatch, SessionResult, Task } from './types.js';

export interface CliOptions {
  tasksPath: string;
  outputPath: string;
  dryRun: boolean;
  validate: boolean;
  help: boolean;
  quiet: boolean;
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    tasksPath: './TASKS.md',
    outputPath: './MORNING_REPORT.md',
    dryRun: false,
    validate: false,
    help: false,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--tasks':
        i++;
        options.tasksPath = args[i] ?? options.tasksPath;
        break;
      case '--output':
        i++;
        options.outputPath = args[i] ?? options.outputPath;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--validate':
        options.validate = true;
        break;
      case '--help':
        options.help = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
    }
  }

  return options;
}

function printUsage(): void {
  const usage = `cowork - Overnight Claude Code agent workflow framework

Usage: cowork [options]

Options:
  --tasks <path>    Path to tasks file (default: ./TASKS.md)
  --output <path>   Path for report output (default: ./MORNING_REPORT.md)
  --dry-run         Show execution plan without writing any files
  --validate        Validate tasks and report errors, then exit
  --quiet           Suppress progress output; only print the report path
  --help            Show this help message and exit
`;
  process.stdout.write(usage);
}

function runValidation(tasks: Task[]): void {
  const result = validateTasks(tasks);
  const cycles = detectCycles(tasks);

  if (result.valid && cycles.length === 0) {
    process.stdout.write(`Validation passed: ${tasks.length} tasks, no errors found.\n`);
    return;
  }

  if (result.errors.length > 0) {
    process.stderr.write('Validation errors:\n');
    for (const err of result.errors) {
      process.stderr.write(`  - [${err.task || '(untitled)'}] ${err.field}: ${err.message}\n`);
    }
  }

  if (cycles.length > 0) {
    process.stderr.write('Circular dependencies detected:\n');
    for (const cycle of cycles) {
      process.stderr.write(`  - ${cycle.join(' -> ')}\n`);
    }
  }

  process.exit(1);
}

function printExecutionPlan(batches: ExecutionBatch[]): void {
  process.stdout.write('Execution Plan\n');
  process.stdout.write('==============\n\n');
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    process.stdout.write(`Batch ${i + 1} (${mode}):\n`);
    for (const task of batch.tasks) {
      process.stdout.write(`  - [${task.priority}] ${task.title}\n`);
    }
    process.stdout.write('\n');
  }
}

export function formatSummary(result: SessionResult): string {
  const elapsed = result.endTime.getTime() - result.startTime.getTime();
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const time = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return `Summary: ${result.completed.length} completed, ${result.failed.length} failed, ${result.skipped.length} skipped (${time})`;
}

function printProgress(batches: ExecutionBatch[], result: SessionResult): void {
  const allResults = [...result.completed, ...result.failed, ...result.skipped];
  let taskIndex = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    process.stdout.write(`Executing batch ${i + 1}/${batches.length} (${mode})...\n`);
    for (const _task of batch.tasks) {
      const finished = allResults[taskIndex];
      const tag = finished?.status === 'completed' ? 'DONE' : finished?.status === 'failed' ? 'FAIL' : 'SKIP';
      process.stdout.write(`  [${tag}] ${finished?.title ?? _task.title}\n`);
      taskIndex++;
    }
  }
  process.stdout.write(`\n${formatSummary(result)}\n`);
}

export async function run(options: CliOptions): Promise<void> {
  if (options.help) { printUsage(); return; }

  let content: string;
  try {
    content = await readFile(options.tasksPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }

  const tasks = parseTasksFile(content);
  if (options.validate) { runValidation(tasks); return; }

  const batches = buildExecutionPlan(tasks);
  if (options.dryRun) { printExecutionPlan(batches); return; }

  const defaultRunner: TaskRunner = async () => 'completed';
  const sessionResult = await executePlan(batches, defaultRunner);

  if (!options.quiet) { printProgress(batches, sessionResult); }

  let updatedContent = content;
  for (const task of sessionResult.completed) {
    updatedContent = updateTaskStatus(updatedContent, task.title, 'completed');
  }
  for (const task of sessionResult.failed) {
    updatedContent = updateTaskStatus(updatedContent, task.title, 'failed');
  }
  await writeFile(options.tasksPath, updatedContent);

  const report = generateReport(sessionResult, []);
  await writeFile(options.outputPath, report);
  process.stdout.write(`Report written to ${options.outputPath}\n`);
}

export async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  try {
    await run(options);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectRun) {
  main();
}
