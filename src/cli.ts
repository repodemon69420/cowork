#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { runHandler, statusHandler, reportHandler } from './cli-handlers.js';

function printUsage(): void {
  const usage = `Usage: cowork <command> [options]

Commands:
  run      Parse TASKS.md and print execution plan
  status   Print task status table
  report   Generate markdown report from session JSON

Options:
  --file <path>   Path to TASKS.md (default: ./TASKS.md)
  --input <path>  Path to session result JSON (for report command)
  --help          Show this help message`;

  console.log(usage);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printUsage();
    process.exit(0);
  }

  const subcommandArgs = args.slice(1);

  if (subcommand === 'run') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        file: { type: 'string', default: './TASKS.md' },
      },
      strict: true,
    });

    const filePath = values.file as string;
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      console.error(`Error: Could not read file '${filePath}'`);
      process.exit(1);
    }

    const output = runHandler(content);
    console.log(output);
  } else if (subcommand === 'status') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        file: { type: 'string', default: './TASKS.md' },
      },
      strict: true,
    });

    const filePath = values.file as string;
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      console.error(`Error: Could not read file '${filePath}'`);
      process.exit(1);
    }

    const output = statusHandler(content);
    console.log(output);
  } else if (subcommand === 'report') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        input: { type: 'string' },
        format: { type: 'string', default: 'markdown' },
      },
      strict: true,
    });

    if (!values.input) {
      console.error('Error: --input <path> is required for the report command');
      process.exit(1);
    }

    let content: string;
    try {
      content = await readFile(values.input, 'utf-8');
    } catch {
      console.error(`Error: Could not read file '${values.input}'`);
      process.exit(1);
    }

    try {
      const output = reportHandler(content, values.format as 'markdown' | 'json');
      console.log(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  } else {
    console.error(`Error: Unknown command '${subcommand}'`);
    printUsage();
    process.exit(1);
  }
}

main();
