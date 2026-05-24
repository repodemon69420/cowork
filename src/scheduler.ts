import { Task, ExecutionBatch, ExecutionPlan, TaskPriority } from './types.js';

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

export function detectCycles(tasks: Task[]): string[][] {
  // Build adjacency map: task title -> titles it depends on (only among known tasks)
  const taskTitles = new Set(tasks.map(t => t.title));
  const adj = new Map<string, string[]>();
  for (const task of tasks) {
    const deps = (task.dependsOn ?? []).filter(d => taskTitles.has(d));
    adj.set(task.title, deps);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    onStack.add(node);
    stack.push(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (onStack.has(neighbor)) {
        // Found a cycle — extract it from the stack
        const cycleStart = stack.indexOf(neighbor);
        const cycle = stack.slice(cycleStart);
        cycles.push(cycle);
      }
    }

    stack.pop();
    onStack.delete(node);
  }

  for (const title of taskTitles) {
    if (!visited.has(title)) {
      dfs(title);
    }
  }

  return cycles;
}

export function buildExecutionPlan(tasks: Task[]): ExecutionPlan {
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
      // Remaining tasks cannot be scheduled — detect cycles among them
      const remainingTasks = [...remaining];
      const cycles = detectCycles(remainingTasks);
      return { batches, cycles };
    }

    const sorted = sortByPriority(ready);
    const parallel = sorted.length > 1;
    batches.push({ tasks: sorted, parallel });

    for (const task of sorted) {
      remaining.delete(task);
      completedTitles.add(task.title);
    }
  }

  return { batches, cycles: [] };
}
