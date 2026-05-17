import { Task, ExecutionBatch, SessionResult } from './types.js';

export type TaskExecutor = (task: Task) => Promise<{ success: boolean; error?: string }>;

export interface RunnerProgress {
  completed: number;
  failed: number;
  remaining: number;
  total: number;
}

async function executeTask(
  task: Task,
  executor: TaskExecutor,
): Promise<Task> {
  try {
    const result = await executor(task);
    if (result.success) {
      return { ...task, status: 'completed' };
    }
    return { ...task, status: 'failed' };
  } catch {
    return { ...task, status: 'failed' };
  }
}

async function executeBatchParallel(
  tasks: Task[],
  executor: TaskExecutor,
): Promise<Task[]> {
  return Promise.all(tasks.map((task) => executeTask(task, executor)));
}

async function executeBatchSequential(
  tasks: Task[],
  executor: TaskExecutor,
): Promise<Task[]> {
  const results: Task[] = [];
  for (const task of tasks) {
    const result = await executeTask(task, executor);
    results.push(result);
  }
  return results;
}

export async function executePlan(
  batches: ExecutionBatch[],
  executor: TaskExecutor,
): Promise<SessionResult> {
  const startTime = new Date();
  const completed: Task[] = [];
  const failed: Task[] = [];
  const skipped: Task[] = [];

  for (const batch of batches) {
    const results = batch.parallel
      ? await executeBatchParallel(batch.tasks, executor)
      : await executeBatchSequential(batch.tasks, executor);

    for (const task of results) {
      if (task.status === 'completed') {
        completed.push(task);
      } else if (task.status === 'failed') {
        failed.push(task);
      } else {
        skipped.push(task);
      }
    }
  }

  const endTime = new Date();

  return { completed, failed, skipped, startTime, endTime };
}
