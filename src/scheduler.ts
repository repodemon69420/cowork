import { Task, ExecutionBatch, TaskPriority } from './types.js';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

function hasUnmetDependencies(task: Task, completedTitles: Set<string>): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  return task.dependsOn.some((dep: string) => !completedTitles.has(dep));
}

export function buildExecutionPlan(tasks: Task[]): ExecutionBatch[] {
  const batches: ExecutionBatch[] = [];
  const pending = tasks.filter(t => t.status === 'pending');
  const completedTitles = new Set<string>(
    tasks.filter(t => t.status === 'completed').map(t => t.title)
  );

  const remaining = new Set<Task>(pending);

  while (remaining.size > 0) {
    const ready: Task[] = [];

    for (const task of remaining) {
      if (!hasUnmetDependencies(task, completedTitles)) {
        ready.push(task);
      }
    }

    if (ready.length === 0) {
      const skipped = sortByPriority([...remaining]);
      batches.push({ tasks: skipped, parallel: false });
      break;
    }

    const sorted = sortByPriority(ready);
    const parallel = sorted.length > 1;
    batches.push({ tasks: sorted, parallel });

    for (const task of sorted) {
      remaining.delete(task);
      completedTitles.add(task.title);
    }
  }

  return batches;
}
