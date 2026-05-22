import { Task, SessionResult } from './types.js';
import { buildExecutionPlan } from './scheduler.js';

export function createSessionResult(
  completed: Task[],
  failed: Task[],
  skipped: Task[],
  startTime?: Date,
  endTime?: Date,
): SessionResult {
  const now = new Date();
  return {
    completed: [...completed],
    failed: [...failed],
    skipped: [...skipped],
    startTime: startTime ?? now,
    endTime: endTime ?? now,
  };
}

export function runSession(tasks: Task[]): SessionResult {
  const startTime = new Date();

  const alreadyCompleted = tasks.filter(t => t.status === 'completed');
  const alreadyFailed = tasks.filter(t => t.status === 'failed');

  const batches = buildExecutionPlan(tasks);

  const completed: Task[] = [...alreadyCompleted];
  const skipped: Task[] = [];

  for (const batch of batches) {
    const hasUnresolvable = batch.tasks.some(
      t => t.dependsOn?.some(dep => !completed.some(c => c.title === dep)) ?? false,
    );

    if (hasUnresolvable && !batch.parallel) {
      for (const task of batch.tasks) {
        const depsUnmet = task.dependsOn?.some(
          dep => !completed.some(c => c.title === dep),
        ) ?? false;

        if (depsUnmet) {
          skipped.push({ ...task, status: 'skipped' });
        } else {
          completed.push({ ...task, status: 'completed' });
        }
      }
    } else {
      for (const task of batch.tasks) {
        completed.push({ ...task, status: 'completed' });
      }
    }
  }

  const endTime = new Date();

  return {
    completed,
    failed: [...alreadyFailed],
    skipped,
    startTime,
    endTime,
  };
}

export function summarizeSession(result: SessionResult): string {
  const ms = result.endTime.getTime() - result.startTime.getTime();
  const minutes = Math.floor(ms / 60000);
  return `Session complete: ${result.completed.length} completed, ${result.failed.length} failed, ${result.skipped.length} skipped (duration: ${minutes}m)`;
}
