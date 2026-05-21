#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { runHandler, statusHandler, reportHandler, historyHandler, addHandler } from './cli-handlers.js';
import { listSessionLogs, loadSessionLog } from './history.js';
import { loadConfig, resolveConfig } from './config.js';
import type { CoworkConfig } from './config.js';
import type { TaskPriority, TaskType } from './types.js';

const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const VALID_TYPES: TaskType[] = ['code', 'research', 'docs', 'refactor', 'test', 'design'];

function printUsage(): void {
  const usage = `Usage: cowork <command> [options]

Commands:
  run      Parse TASKS.md and print execution plan
  status   Print task status table
  report   Generate markdown report from session JSON
  history  Show session history log
  add      Add a new task to the tasks file

Options:
  --file <path>     Path to TASKS.md (default: ./TASKS.md)
  --input <path>    Path to session result JSON (for report command)
  --log-dir <path>  Path to log directory (for history command)
  --help            Show this help message`;

  console.log(usage);
}

function buildCliOverrides(values: Record<string, unknown>): Partial<CoworkConfig> {
  return {
    ...(values.file !== undefined ? { tasksFile: values.file as string } : {}),
    ...(values.format !== undefined ? { outputFormat: values.format as CoworkConfig['outputFormat'] } : {}),
    ...(values['log-dir'] !== undefined ? { logDir: values['log-dir'] as string } : {}),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printUsage();
    process.exit(0);
  }

  let fileConfig: CoworkConfig;
  try {
    fileConfig = await loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error loading config: ${message}`);
    process.exit(1);
  }

  const subcommandArgs = args.slice(1);

  if (subcommand === 'run') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        file: { type: 'string' },
        execute: { type: 'boolean', default: false },
      },
      strict: true,
    });

    const cliOverrides = buildCliOverrides(values);
    const config = resolveConfig(cliOverrides, fileConfig);
    const filePath = config.tasksFile;
    const executeFlag = values.execute as boolean;

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      console.error(`Error: Could not read file '${filePath}'`);
      process.exit(1);
    }

    if (executeFlag) {
      console.log('Not implemented yet: --execute requires a real taskRunner.');
      process.exit(0);
    }

    const output = runHandler(content, { execute: false });
    console.log(output);
  } else if (subcommand === 'status') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        file: { type: 'string' },
      },
      strict: true,
    });

    const cliOverrides = buildCliOverrides(values);
    const config = resolveConfig(cliOverrides, fileConfig);
    const filePath = config.tasksFile;

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
        format: { type: 'string' },
      },
      strict: true,
    });

    if (!values.input) {
      console.error('Error: --input <path> is required for the report command');
      process.exit(1);
    }

    const cliOverrides = buildCliOverrides(values);
    const config = resolveConfig(cliOverrides, fileConfig);

    let content: string;
    try {
      content = await readFile(values.input, 'utf-8');
    } catch {
      console.error(`Error: Could not read file '${values.input}'`);
      process.exit(1);
    }

    try {
      const output = reportHandler(content, config.outputFormat);
      console.log(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  } else if (subcommand === 'history') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        'log-dir': { type: 'string' },
      },
      strict: true,
    });

    const cliOverrides = buildCliOverrides(values);
    const config = resolveConfig(cliOverrides, fileConfig);
    const logDir = config.logDir;

    try {
      const logPaths = await listSessionLogs(logDir);
      const logs: Array<{ path: string; data: object }> = [];

      for (const logPath of logPaths) {
        const data = await loadSessionLog(logPath);
        logs.push({ path: logPath, data });
      }

      const output = historyHandler(logs);
      console.log(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  } else if (subcommand === 'add') {
    const { values } = parseArgs({
      args: subcommandArgs,
      options: {
        title: { type: 'string' },
        priority: { type: 'string', default: 'medium' },
        type: { type: 'string', default: 'code' },
        context: { type: 'string', default: '' },
        'depends-on': { type: 'string' },
        file: { type: 'string' },
      },
      strict: true,
    });

    if (!values.title || values.title.trim() === '') {
      console.error('Error: --title is required and must be non-empty');
      process.exit(1);
    }

    const priority = values.priority as string;
    if (!VALID_PRIORITIES.includes(priority as TaskPriority)) {
      console.error(
        `Error: Invalid priority '${priority}'. Valid options: ${VALID_PRIORITIES.join(', ')}`,
      );
      process.exit(1);
    }

    const type = values.type as string;
    if (!VALID_TYPES.includes(type as TaskType)) {
      console.error(
        `Error: Invalid type '${type}'. Valid options: ${VALID_TYPES.join(', ')}`,
      );
      process.exit(1);
    }

    const dependsOn = values['depends-on']
      ? values['depends-on'].split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const cliOverrides = buildCliOverrides(values);
    const config = resolveConfig(cliOverrides, fileConfig);
    const filePath = config.tasksFile;

    try {
      const result = await addHandler({
        title: values.title,
        priority: priority as TaskPriority,
        type: type as TaskType,
        context: values.context ?? '',
        dependsOn,
        filePath,
      });
      console.log(result);
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
