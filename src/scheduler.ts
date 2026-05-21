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

/**
 * Detects circular dependencies among tasks using DFS-based cycle detection.
 * Returns an array of cycles, where each cycle is an array of task titles.
 */
export function detectCircularDependencies(tasks: Task[]): string[][] {
  const taskMap = new Map<string, readonly string[]>();
  for (const task of tasks) {
    taskMap.set(task.title, task.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const cycles: string[][] = [];

  for (const task of tasks) {
    if (visited.has(task.title)) continue;
    const cycle = findCycleFrom(task.title, taskMap, visited);
    if (cycle.length > 0) {
      cycles.push(cycle);
    }
  }

  return cycles;
}

function findCycleFrom(
  start: string,
  taskMap: Map<string, readonly string[]>,
  globalVisited: Set<string>,
): string[] {
  const path: string[] = [];
  const pathSet = new Set<string>();
  const localVisited = new Set<string>();

  const stack: Array<{ node: string; depIndex: number }> = [
    { node: start, depIndex: 0 },
  ];
  path.push(start);
  pathSet.add(start);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const deps = taskMap.get(frame.node) ?? [];

    if (frame.depIndex >= deps.length) {
      stack.pop();
      path.pop();
      pathSet.delete(frame.node);
      localVisited.add(frame.node);
      globalVisited.add(frame.node);
      continue;
    }

    const nextDep = deps[frame.depIndex];
    frame.depIndex += 1;

    if (!taskMap.has(nextDep)) continue;

    if (pathSet.has(nextDep)) {
      const cycleStart = path.indexOf(nextDep);
      const cycle = path.slice(cycleStart);
      cycle.forEach(t => globalVisited.add(t));
      return cycle;
    }

    if (localVisited.has(nextDep) || globalVisited.has(nextDep)) continue;

    path.push(nextDep);
    pathSet.add(nextDep);
    stack.push({ node: nextDep, depIndex: 0 });
  }

  return [];
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
      batches.push({ tasks: skipped, parallel: false, circular: true });
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
