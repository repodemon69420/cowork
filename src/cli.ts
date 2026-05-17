#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseTasksFile } from './parser.js';
import { validateTasks } from './validator.js';
import { buildExecutionPlan } from './scheduler.js';
import { formatValidationIssues, formatExecutionPlan, formatSummary } from './format.js';

function parseArgs(argv: readonly string[]): { file: string; help: boolean } {
  let file = path.resolve('TASKS.md');
  let help = false;

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      help = true;
    } else if (args[i] === '--file' || args[i] === '-f') {
      i++;
      if (i < args.length) {
        file = path.resolve(args[i]);
      } else {
        console.error('Error: --file requires a path argument');
        process.exit(1);
      }
    }
  }

  return { file, help };
}

function printHelp(): void {
  console.log(`Usage: cowork [options]

Options:
  --file, -f <path>  Path to tasks file (default: ./TASKS.md)
  --help, -h         Show this help message`);
}

function main(): void {
  const { file, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  // Read the file
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch {
    console.error(`Error: Cannot read file "${file}"`);
    process.exit(1);
  }

  // Parse tasks
  const tasks = parseTasksFile(content);

  // Validate
  const validationResult = validateTasks(tasks);
  const issuesOutput = formatValidationIssues(validationResult);

  if (issuesOutput) {
    console.log(issuesOutput);
    console.log('');
  }

  if (!validationResult.valid) {
    process.exit(1);
  }

  // Build execution plan
  const batches = buildExecutionPlan(tasks);

  // Print summary and plan
  console.log(formatSummary(tasks, batches));
  console.log('');
  console.log(formatExecutionPlan(batches));
}

main();
