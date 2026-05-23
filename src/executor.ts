import { Task, ExecutionBatch, SessionResult } from './types.js';

export interface ExecutorConfig {
  concurrencyLimit: number;
  taskTimeoutMs: number;
}

export type TaskRunner = (task: Task, signal: AbortSignal) => Promise<void>;

const DEFAULT_CONFIG: ExecutorConfig = {
  concurrencyLimit: 5,
  taskTimeoutMs: 30 * 60 * 1000,
};

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += limit) {
    chunks.push(items.slice(i, i + limit));
  }
  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(fn));
  }
}

function runTaskWithTimeout(
  task: Task,
  runner: TaskRunner,
  timeoutMs: number,
): Promise<Task> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return runner(task, controller.signal)
    .then(() => ({ ...task, status: 'completed' as const }))
    .catch(() => ({ ...task, status: 'failed' as const }))
    .finally(() => clearTimeout(timeout));
}

function batchAllFailed(results: Task[]): boolean {
  return results.length > 0 && results.every((t) => t.status === 'failed');
}

function skipBatch(batch: ExecutionBatch): Task[] {
  return batch.tasks.map((t) => ({ ...t, status: 'skipped' as const }));
}

async function executeParallelBatch(
  batch: ExecutionBatch,
  runner: TaskRunner,
  config: ExecutorConfig,
): Promise<Task[]> {
  const results: Task[] = [];

  await runWithConcurrency(batch.tasks, config.concurrencyLimit, async (task) => {
    const result = await runTaskWithTimeout(task, runner, config.taskTimeoutMs);
    results.push(result);
  });

  return results;
}

async function executeSequentialBatch(
  batch: ExecutionBatch,
  runner: TaskRunner,
  config: ExecutorConfig,
): Promise<Task[]> {
  const results: Task[] = [];

  for (const task of batch.tasks) {
    const result = await runTaskWithTimeout(task, runner, config.taskTimeoutMs);
    results.push(result);
  }

  return results;
}

export async function executePlan(
  batches: ExecutionBatch[],
  runner: TaskRunner,
  config?: Partial<ExecutorConfig>,
): Promise<SessionResult> {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = new Date();
  const completed: Task[] = [];
  const failed: Task[] = [];
  const skipped: Task[] = [];
  let skipRemaining = false;

  for (const batch of batches) {
    if (skipRemaining) {
      skipped.push(...skipBatch(batch));
      continue;
    }

    const results = batch.parallel
      ? await executeParallelBatch(batch, runner, resolvedConfig)
      : await executeSequentialBatch(batch, runner, resolvedConfig);

    for (const task of results) {
      if (task.status === 'completed') {
        completed.push(task);
      } else {
        failed.push(task);
      }
    }

    if (batchAllFailed(results)) {
      skipRemaining = true;
    }
  }

  return { completed, failed, skipped, startTime, endTime: new Date() };
}
