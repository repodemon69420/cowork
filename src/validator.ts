import { Task } from './types.js';

export interface ValidationIssue {
  type: string;
  message: string;
  taskTitle?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function findDuplicateTitles(tasks: Task[]): ValidationIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const task of tasks) {
    const title = task.title.trim();
    if (title && seen.has(title)) {
      duplicates.add(title);
    }
    seen.add(title);
  }

  return [...duplicates].map((title) => ({
    type: 'duplicate-title',
    message: `Duplicate task title: "${title}"`,
    taskTitle: title,
  }));
}

function findEmptyTitles(tasks: Task[]): ValidationIssue[] {
  return tasks
    .filter((task) => task.title.trim() === '')
    .map(() => ({
      type: 'empty-title',
      message: 'Task has an empty or whitespace-only title',
    }));
}

function findSelfDependencies(tasks: Task[]): ValidationIssue[] {
  return tasks
    .filter((task) => task.dependsOn?.includes(task.title))
    .map((task) => ({
      type: 'self-dependency',
      message: `Task "${task.title}" depends on itself`,
      taskTitle: task.title,
    }));
}

function findMissingDependencies(tasks: Task[]): ValidationIssue[] {
  const titles = new Set(tasks.map((t) => t.title));
  const issues: ValidationIssue[] = [];

  for (const task of tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (dep !== task.title && !titles.has(dep)) {
        issues.push({
          type: 'missing-dependency',
          message: `Task "${task.title}" depends on "${dep}" which does not exist`,
          taskTitle: task.title,
        });
      }
    }
  }

  return issues;
}

function findCircularDependencies(tasks: Task[]): ValidationIssue[] {
  const adjacency = new Map<string, string[]>();
  for (const task of tasks) {
    adjacency.set(task.title, task.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      if (neighbor === node) continue;
      if (adjacency.has(neighbor)) {
        dfs(neighbor, [...path, node]);
      }
    }

    inStack.delete(node);
  }

  for (const task of tasks) {
    if (!visited.has(task.title)) {
      dfs(task.title, []);
    }
  }

  return cycles.map((cycle) => ({
    type: 'circular-dependency',
    message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`,
  }));
}

function findCompletedWithPendingDeps(tasks: Task[]): ValidationIssue[] {
  const statusByTitle = new Map<string, string>();
  for (const task of tasks) {
    statusByTitle.set(task.title, task.status);
  }

  const warnings: ValidationIssue[] = [];

  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    for (const dep of task.dependsOn ?? []) {
      if (statusByTitle.get(dep) === 'pending') {
        warnings.push({
          type: 'completed-with-pending-dep',
          message: `Completed task "${task.title}" has a pending dependency "${dep}"`,
          taskTitle: task.title,
        });
      }
    }
  }

  return warnings;
}

export function validateTasks(tasks: Task[]): ValidationResult {
  const errors: ValidationIssue[] = [
    ...findEmptyTitles(tasks),
    ...findDuplicateTitles(tasks),
    ...findSelfDependencies(tasks),
    ...findMissingDependencies(tasks),
    ...findCircularDependencies(tasks),
  ];

  const warnings: ValidationIssue[] = [
    ...findCompletedWithPendingDeps(tasks),
  ];

  return { errors, warnings };
}
