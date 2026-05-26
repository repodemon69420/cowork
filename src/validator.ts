import { Task } from './types.js';

export interface ValidationError {
  task: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates an array of tasks for common issues:
 * 1. No duplicate titles (case-insensitive)
 * 2. Each task has a non-empty title
 * 3. Each task has a non-empty context
 * 4. Dependencies reference existing task titles (case-insensitive)
 * 5. No self-dependencies
 */
export function validateTasks(tasks: Task[]): ValidationResult {
  const errors: ValidationError[] = [];

  const titleSet = new Map<string, string>();

  for (const task of tasks) {
    validateTitle(task, titleSet, errors);
    validateContext(task, errors);
    validateDependencies(task, tasks, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateTitle(
  task: Task,
  titleSet: Map<string, string>,
  errors: ValidationError[],
): void {
  if (task.title.trim() === '') {
    errors.push({
      task: '',
      field: 'title',
      message: 'Task title must not be empty',
    });
    return;
  }

  const lower = task.title.toLowerCase();
  const existing = titleSet.get(lower);
  if (existing !== undefined) {
    errors.push({
      task: task.title,
      field: 'title',
      message: `Duplicate title (case-insensitive match with "${existing}")`,
    });
  } else {
    titleSet.set(lower, task.title);
  }
}

function validateContext(
  task: Task,
  errors: ValidationError[],
): void {
  if (task.context.trim() === '') {
    errors.push({
      task: task.title,
      field: 'context',
      message: 'Task context must not be empty',
    });
  }
}

function validateDependencies(
  task: Task,
  allTasks: Task[],
  errors: ValidationError[],
): void {
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return;
  }

  const allTitlesLower = new Set(
    allTasks.map(t => t.title.toLowerCase()),
  );

  for (const dep of task.dependsOn) {
    if (dep.toLowerCase() === task.title.toLowerCase()) {
      errors.push({
        task: task.title,
        field: 'dependsOn',
        message: `Task cannot depend on itself ("${dep}")`,
      });
    } else if (!allTitlesLower.has(dep.toLowerCase())) {
      errors.push({
        task: task.title,
        field: 'dependsOn',
        message: `Dependency "${dep}" does not match any existing task title`,
      });
    }
  }
}

/**
 * Finds circular dependency chains using DFS.
 * Returns an array of cycles, where each cycle is an array of task titles
 * forming the loop (first and last element are the same).
 * Returns [] if no cycles found.
 */
export function detectCycles(tasks: Task[]): string[][] {
  const graph = buildDependencyGraph(tasks);
  const allTitles = new Set(tasks.map(t => t.title));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  for (const task of tasks) {
    if (!visited.has(task.title)) {
      dfs(task.title, graph, allTitles, visited, inStack, [], cycles);
    }
  }

  return cycles;
}

function buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const titleMap = new Map<string, string>();

  for (const task of tasks) {
    titleMap.set(task.title.toLowerCase(), task.title);
    if (!graph.has(task.title)) {
      graph.set(task.title, []);
    }
  }

  for (const task of tasks) {
    if (task.dependsOn) {
      const deps: string[] = [];
      for (const dep of task.dependsOn) {
        const resolved = titleMap.get(dep.toLowerCase());
        if (resolved !== undefined) {
          deps.push(resolved);
        }
      }
      graph.set(task.title, deps);
    }
  }

  return graph;
}

function dfs(
  node: string,
  graph: Map<string, string[]>,
  allTitles: Set<string>,
  visited: Set<string>,
  inStack: Set<string>,
  path: string[],
  cycles: string[][],
): void {
  visited.add(node);
  inStack.add(node);
  path.push(node);

  const neighbors = graph.get(node) ?? [];
  for (const neighbor of neighbors) {
    if (!allTitles.has(neighbor)) {
      continue;
    }

    if (inStack.has(neighbor)) {
      const cycleStart = path.indexOf(neighbor);
      const cycle = [...path.slice(cycleStart), neighbor];
      cycles.push(cycle);
    } else if (!visited.has(neighbor)) {
      dfs(neighbor, graph, allTitles, visited, inStack, path, cycles);
    }
  }

  path.pop();
  inStack.delete(node);
}
