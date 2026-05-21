import { CoworkConfig } from './config.js';
import { Task, ExecutionBatch, SessionResult, TaskRunResult, ProgressEvent } from './types.js';

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
  onTaskProgress?: (task: Task, result: TaskRunResult) => void,
): Promise<Array<{ index: number; result: TaskRunResult }>> {
  const results: Array<{ index: number; result: TaskRunResult }> = [];
  const queue = [...tasks];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const result = await runWithTimeout(item.task, taskRunner, timeoutMs);
      results.push({ index: item.index, result });
      onTaskProgress?.(item.task, result);
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
  private readonly onProgress?: (event: ProgressEvent) => void;

  constructor(
    config: CoworkConfig,
    taskRunner: TaskRunner,
    onProgress?: (event: ProgressEvent) => void,
  ) {
    this.config = config;
    this.taskRunner = taskRunner;
    this.onProgress = onProgress;
  }

  async execute(batches: ExecutionBatch[]): Promise<SessionResult> {
    const startTime = new Date();
    const completed: Task[] = [];
    const failed: Task[] = [];
    const skipped: Task[] = [];
    const failedTitles = new Set<string>();

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const { tasksToRun, tasksToSkip } = this.partitionBatch(
        batch.tasks,
        failedTitles,
      );

      for (const task of tasksToSkip) {
        skipped.push({ ...task, status: 'skipped' });
      }

      if (tasksToRun.length === 0) continue;

      this.onProgress?.({
        type: 'batch-start',
        batchIndex,
        taskCount: tasksToRun.length,
      });

      const indexedTasks = tasksToRun.map((task, index) => ({ task, index }));
      const concurrency = batch.parallel ? this.config.concurrency : 1;

      const onTaskProgress = (task: Task, result: TaskRunResult): void => {
        this.onProgress?.({
          type: 'task-end',
          batchIndex,
          taskTitle: task.title,
          result,
        });
      };

      const emitTaskStart = (task: Task): void => {
        this.onProgress?.({
          type: 'task-start',
          batchIndex,
          taskTitle: task.title,
        });
      };

      const originalRunner = this.taskRunner;
      const wrappedRunner: TaskRunner = async (task: Task) => {
        emitTaskStart(task);
        return originalRunner(task);
      };

      const results = await runWithConcurrency(
        indexedTasks,
        wrappedRunner,
        concurrency,
        this.config.timeout,
        onTaskProgress,
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

      this.onProgress?.({ type: 'batch-end', batchIndex });
    }

    const endTime = new Date();
    const sessionResult = { completed, failed, skipped, startTime, endTime };

    this.onProgress?.({ type: 'session-end', result: sessionResult });

    return sessionResult;
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
