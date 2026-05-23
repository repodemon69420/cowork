#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseTasksFile } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import type { ExecutionBatch } from './types.js';

export interface CliArgs {
  tasksFile: string;
  dryRun: boolean;
  help: boolean;
  output: string | undefined;
}

export interface RunResult {
  exitCode: number;
  outputPath?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    tasksFile: 'TASKS.md',
    dryRun: false,
    help: false,
    output: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help') {
      args.help = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--output') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--output requires a path');
      }
      args.output = next;
      i++;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      args.tasksFile = arg;
    }
  }

  return args;
}

function printHelp(print: (msg: string) => void): void {
  print('Usage: cowork [options] [tasks-file]');
  print('');
  print('Run the cowork task scheduler on a TASKS.md file.');
  print('');
  print('Arguments:');
  print('  tasks-file          Path to the tasks file (default: TASKS.md)');
  print('');
  print('Options:');
  print('  --help              Show this help message and exit');
  print('  --dry-run           Display execution batches without running');
  print('  --output <path>     Specify the morning report output path');
}

function formatBatches(
  batches: ExecutionBatch[],
  print: (msg: string) => void,
): void {
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const mode = batch.parallel ? 'parallel' : 'sequential';
    print(`Batch ${i + 1} (${mode}):`);
    for (const task of batch.tasks) {
      print(`  - [${task.priority}] ${task.title} (${task.type})`);
    }
    print('');
  }
}

export async function run(
  args: CliArgs,
  print: (msg: string) => void = console.log,
): Promise<RunResult> {
  if (args.help) {
    printHelp(print);
    return { exitCode: 0 };
  }

  let content: string;
  try {
    content = await readFile(args.tasksFile, 'utf-8');
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      print(`Error: Tasks file not found: ${args.tasksFile}`);
    } else {
      print(`Error: Could not read tasks file: ${error.message}`);
    }
    return { exitCode: 1 };
  }

  const tasks = parseTasksFile(content);

  if (tasks.length === 0) {
    print('No tasks found in the tasks file.');
    return { exitCode: 0 };
  }

  const batches = buildExecutionPlan(tasks);

  if (args.dryRun) {
    print('Dry run — execution plan:');
    print('');
    formatBatches(batches, print);
    print(`Total: ${tasks.length} tasks in ${batches.length} batches`);
  } else {
    print(`Found ${tasks.length} tasks, planned ${batches.length} batches:`);
    print('');
    formatBatches(batches, print);
  }

  const result: RunResult = { exitCode: 0 };

  if (args.output) {
    result.outputPath = args.output;
    print(`Report will be written to: ${args.output}`);
  }

  return result;
}

async function main(): Promise<void> {
  const userArgs = process.argv.slice(2);

  let args: CliArgs;
  try {
    args = parseArgs(userArgs);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Error: ${error.message}`);
    console.error('Run "cowork --help" for usage information.');
    process.exit(1);
  }

  const result = await run(args);
  process.exit(result.exitCode);
}

const isDirectRun =
  process.argv[1] != null &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectRun) {
  main();
}
