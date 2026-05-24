import type { CoworkConfig } from './config.js';
import type { Task } from './types.js';
import type { SessionContext } from './session.js';
import { createSession } from './session.js';
import { createLogger } from './logger.js';
import { parseTasksFile } from './parser.js';
import { readFileContent } from './fs-adapter.js';
import { stepSync, stepPlan, stepReport } from './steps.js';

export interface RunOptions {
  dryRun: boolean;
  iteration?: number;
}

export interface RunResult {
  context: SessionContext;
  log: string[];
}

export function runIteration(config: CoworkConfig, tasks: Task[], options: RunOptions): RunResult {
  const logger = createLogger();
  const iteration = options.iteration ?? 1;
  let ctx = createSession(config, iteration);

  logger.info(`Starting iteration ${iteration}`);
  ctx = stepSync(ctx);
  ctx = stepPlan(ctx, tasks);

  const batches = ctx.plan?.batches ?? [];
  logger.info(`Plan: ${batches.length} batch(es), ${batches.map(b => b.tasks.length).join(', ')} tasks per batch`);

  if (options.dryRun) {
    logger.info('Dry run — skipping execution');
  } else {
    logger.info('Execution would happen here');
  }

  ctx = { ...ctx, state: 'reporting' };
  ctx = stepReport(ctx);

  return { context: ctx, log: logger.getLog() };
}

export function runFromFile(config: CoworkConfig, taskFilePath: string, options: RunOptions): RunResult {
  const content = readFileContent(taskFilePath);
  const tasks = parseTasksFile(content);
  return runIteration(config, tasks, options);
}
