import { Task, TaskStatus, ExecutionBatch, SessionResult } from './types.js';

export type TaskRunner = (task: Task) => Promise<TaskStatus>;

export async function executeTask(task: Task, runner: TaskRunner): Promise<Task> {
  let status: TaskStatus;
  try {
    status = await runner(task);
  } catch {
    status = 'failed';
  }
  return { ...task, status };
}

export async function executeBatch(
  batch: ExecutionBatch,
  runner: TaskRunner,
): Promise<Task[]> {
  if (batch.parallel) {
    return Promise.all(batch.tasks.map(task => executeTask(task, runner)));
  }

  const results: Task[] = [];
  for (const task of batch.tasks) {
    results.push(await executeTask(task, runner));
  }
  return results;
}

export async function executePlan(
  batches: ExecutionBatch[],
  runner: TaskRunner,
  onProgress?: (completed: number, total: number) => void,
): Promise<SessionResult> {
  const startTime = new Date();

  const total = batches.reduce((sum, b) => sum + b.tasks.length, 0);
  let completedCount = 0;

  const completed: Task[] = [];
  const failed: Task[] = [];
  const skipped: Task[] = [];

  for (const batch of batches) {
    const results = await executeBatch(batch, runner);
    for (const task of results) {
      completedCount++;
      if (task.status === 'completed') {
        completed.push(task);
      } else if (task.status === 'failed') {
        failed.push(task);
      } else {
        skipped.push(task);
      }
      onProgress?.(completedCount, total);
    }
  }

  const endTime = new Date();

  return { completed, failed, skipped, startTime, endTime };
}
