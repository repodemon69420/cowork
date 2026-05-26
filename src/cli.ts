import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport } from './reporter.js';
import { readFile, writeFile } from './io.js';
import { validateTasks, detectCycles } from './validator.js';
import type { SessionResult } from './types.js';

export interface CliOptions {
  tasksPath: string;
  outputPath: string;
  dryRun: boolean;
  validate: boolean;
  help: boolean;
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    tasksPath: './TASKS.md',
    outputPath: './MORNING_REPORT.md',
    dryRun: false,
    validate: false,
    help: false,
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
  --help            Show this help message and exit
`;
  process.stdout.write(usage);
}

export async function run(options: CliOptions): Promise<void> {
  if (options.help) {
    printUsage();
    return;
  }

  let content: string;
  try {
    content = await readFile(options.tasksPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }

  const tasks = parseTasksFile(content);

  if (options.validate) {
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

  const batches = buildExecutionPlan(tasks);

  if (options.dryRun) {
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
    return;
  }

  const startTime = new Date();
  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');
  const failed = tasks.filter(t => t.status === 'failed');
  const skipped = pending;
  const endTime = new Date();

  const sessionResult: SessionResult = {
    completed,
    failed,
    skipped,
    startTime,
    endTime,
  };

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
