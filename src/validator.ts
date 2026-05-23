import { Task } from './types.js';

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  taskTitle: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

export function validateTasks(tasks: Task[]): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const titleSet = new Set<string>();

  checkMissingContext(tasks, diagnostics);
  checkDuplicateTitles(tasks, diagnostics, titleSet);
  checkDependencies(tasks, diagnostics, titleSet);
  detectCycles(tasks, diagnostics, titleSet);

  const hasErrors = diagnostics.some(d => d.severity === 'error');
  return { valid: !hasErrors, diagnostics };
}

function checkMissingContext(tasks: Task[], diagnostics: Diagnostic[]): void {
  for (const task of tasks) {
    if (task.context === '') {
      diagnostics.push({
        severity: 'warning',
        message: 'Task has no context. Add a description so the agent knows what to do.',
        taskTitle: task.title,
      });
    }
  }
}

function checkDuplicateTitles(
  tasks: Task[],
  diagnostics: Diagnostic[],
  titleSet: Set<string>,
): void {
  const seen = new Set<string>();
  const reported = new Set<string>();

  for (const task of tasks) {
    if (seen.has(task.title) && !reported.has(task.title)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate task title "${task.title}". Each task must have a unique title.`,
        taskTitle: task.title,
      });
      reported.add(task.title);
    }
    seen.add(task.title);
    titleSet.add(task.title);
  }
}

function checkDependencies(
  tasks: Task[],
  diagnostics: Diagnostic[],
  titleSet: Set<string>,
): void {
  for (const task of tasks) {
    if (!task.dependsOn) continue;

    for (const dep of task.dependsOn) {
      if (dep === task.title) {
        diagnostics.push({
          severity: 'error',
          message: `Task depends on itself. Remove "${dep}" from dependsOn.`,
          taskTitle: task.title,
        });
      } else if (!titleSet.has(dep)) {
        diagnostics.push({
          severity: 'error',
          message: `Depends on "${dep}" which does not exist. Check for typos or add the missing task.`,
          taskTitle: task.title,
        });
      }
    }
  }
}

function detectCycles(
  tasks: Task[],
  diagnostics: Diagnostic[],
  titleSet: Set<string>,
): void {
  const adjacency = new Map<string, string[]>();
  for (const task of tasks) {
    const deps = (task.dependsOn ?? []).filter(
      dep => dep !== task.title && titleSet.has(dep),
    );
    adjacency.set(task.title, deps);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const title of Array.from(adjacency.keys())) {
    if (!visited.has(title)) {
      dfsCycleCheck(title, adjacency, visited, inStack, diagnostics);
    }
  }
}

function dfsCycleCheck(
  node: string,
  adjacency: Map<string, string[]>,
  visited: Set<string>,
  inStack: Set<string>,
  diagnostics: Diagnostic[],
): void {
  visited.add(node);
  inStack.add(node);

  for (const neighbor of adjacency.get(node) ?? []) {
    if (!visited.has(neighbor)) {
      dfsCycleCheck(neighbor, adjacency, visited, inStack, diagnostics);
    } else if (inStack.has(neighbor)) {
      diagnostics.push({
        severity: 'error',
        message: `Circular dependency detected: "${node}" → "${neighbor}". Break the cycle to continue.`,
        taskTitle: node,
      });
    }
  }

  inStack.delete(node);
}
