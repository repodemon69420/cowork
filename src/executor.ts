import { CoworkConfig } from './config.js';
import { Task, ExecutionBatch, SessionResult, TaskRunResult } from './types.js';

type TaskRunner = (task: Task) => Promise<TaskRunResult>;

/**
 * Runs a task with a timeout enforced via AbortController + setTimeout.
 * Returns the TaskRunResult on success, or a failed result on timeout/error.
 */
async function runWithTimeout(
  task: Task,
  taskRunner: TaskRunner,
  timeoutMs: number,
): Promise<TaskRunResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      taskRunner(task),
      new Promise<TaskRunResult>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Task timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      output: '',
      durationMs: timeoutMs,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs tasks with concurrency limiting.
 * Processes at most `concurrency` tasks at a time.
 */
async function runWithConcurrency(
  tasks: ReadonlyArray<{ task: Task; index: number }>,
  taskRunner: TaskRunner,
  concurrency: number,
  timeoutMs: number,
): Promise<Array<{ index: number; result: TaskRunResult }>> {
  const results: Array<{ index: number; result: TaskRunResult }> = [];
  const queue = [...tasks];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const result = await runWithTimeout(item.task, taskRunner, timeoutMs);
      results.push({ index: item.index, result });
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => processNext(),
  );

  await Promise.all(workers);
  return results;
}

export class TaskExecutor {
  private readonly config: CoworkConfig;
  private readonly taskRunner: TaskRunner;

  constructor(config: CoworkConfig, taskRunner: TaskRunner) {
    this.config = config;
    this.taskRunner = taskRunner;
  }

  async execute(batches: ExecutionBatch[]): Promise<SessionResult> {
    const startTime = new Date();
    const completed: Task[] = [];
    const failed: Task[] = [];
    const skipped: Task[] = [];
    const failedTitles = new Set<string>();

    for (const batch of batches) {
      const { tasksToRun, tasksToSkip } = this.partitionBatch(
        batch.tasks,
        failedTitles,
      );

      for (const task of tasksToSkip) {
        skipped.push({ ...task, status: 'skipped' });
      }

      if (tasksToRun.length === 0) continue;

      const indexedTasks = tasksToRun.map((task, index) => ({ task, index }));
      const concurrency = batch.parallel ? this.config.concurrency : 1;

      const results = await runWithConcurrency(
        indexedTasks,
        this.taskRunner,
        concurrency,
        this.config.timeout,
      );

      for (const { index, result } of results) {
        const task = tasksToRun[index];
        if (result.success) {
          completed.push({ ...task, status: 'completed' });
        } else {
          failed.push({ ...task, status: 'failed' });
          failedTitles.add(task.title);
        }
      }
    }

    const endTime = new Date();
    return { completed, failed, skipped, startTime, endTime };
  }

  /**
   * Splits a batch's tasks into those that can run and those that must be
   * skipped because an upstream dependency has failed.
   */
  private partitionBatch(
    tasks: readonly Task[],
    failedTitles: ReadonlySet<string>,
  ): { tasksToRun: Task[]; tasksToSkip: Task[] } {
    const tasksToRun: Task[] = [];
    const tasksToSkip: Task[] = [];

    for (const task of tasks) {
      const hasFailed = this.hasFailedDependency(task, failedTitles);
      if (hasFailed) {
        tasksToSkip.push(task);
      } else {
        tasksToRun.push(task);
      }
    }

    return { tasksToRun, tasksToSkip };
  }

  private hasFailedDependency(
    task: Task,
    failedTitles: ReadonlySet<string>,
  ): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) return false;
    return task.dependsOn.some((dep: string) => failedTitles.has(dep));
  }
}
