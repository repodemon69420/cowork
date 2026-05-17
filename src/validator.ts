import type { Task } from './types.js';

// ── Types ─────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  taskTitle?: string;
}

export interface ValidationResult {
  valid: boolean; // true if zero errors (warnings are OK)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ── Public API ────────────────────────────────────────────────

/**
 * Validates a parsed Task[] array and returns a structured result
 * describing any errors (empty titles, duplicates, cycles) and
 * warnings (non-existent dependency references).
 *
 * The input array is never mutated.
 */
export function validateTasks(tasks: ReadonlyArray<Task>): ValidationResult {
  const errors: ValidationIssue[] = [
    ...findEmptyTitles(tasks),
    ...findDuplicateTitles(tasks),
    ...findCircularDependencies(tasks),
  ];

  const warnings: ValidationIssue[] = [
    ...findMissingDependencies(tasks),
  ];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Validation helpers ────────────────────────────────────────

function findEmptyTitles(
  tasks: ReadonlyArray<Task>,
): readonly ValidationIssue[] {
  return tasks
    .filter((task) => task.title.trim() === '')
    .map(() => ({
      severity: 'error' as const,
      message: 'Task has an empty title',
    }));
}

function findDuplicateTitles(
  tasks: ReadonlyArray<Task>,
): readonly ValidationIssue[] {
  const seen = new Map<string, number>();

  for (const task of tasks) {
    const title = task.title;
    if (title.trim() === '') continue; // skip empty titles (handled elsewhere)
    seen.set(title, (seen.get(title) ?? 0) + 1);
  }

  const issues: ValidationIssue[] = [];
  for (const [title, count] of seen) {
    if (count > 1) {
      issues.push({
        severity: 'error',
        message: `Duplicate task title: "${title}"`,
        taskTitle: title,
      });
    }
  }

  return issues;
}

function findMissingDependencies(
  tasks: ReadonlyArray<Task>,
): readonly ValidationIssue[] {
  const titleSet = new Set(tasks.map((t) => t.title));
  const issues: ValidationIssue[] = [];

  for (const task of tasks) {
    if (!task.dependsOn) continue;
    for (const dep of task.dependsOn) {
      if (!titleSet.has(dep)) {
        issues.push({
          severity: 'warning',
          message: `Task "${task.title}" depends on non-existent task "${dep}"`,
          taskTitle: task.title,
        });
      }
    }
  }

  return issues;
}

/**
 * Detects circular dependencies using iterative DFS with three-color
 * marking (white/gray/black). When a back-edge is found the cycle
 * path is extracted from the recursion stack.
 */
function findCircularDependencies(
  tasks: ReadonlyArray<Task>,
): readonly ValidationIssue[] {
  // Build adjacency list: task title → list of dependency titles
  const adj = new Map<string, readonly string[]>();
  for (const task of tasks) {
    if (task.dependsOn && task.dependsOn.length > 0) {
      adj.set(task.title, task.dependsOn);
    }
  }

  // Only consider titles that actually exist as tasks
  const taskTitles = new Set(tasks.map((t) => t.title));

  const WHITE = 0;

  const color = new Map<string, number>();
  for (const title of taskTitles) {
    color.set(title, WHITE);
  }

  const reportedCycles = new Set<string>();
  const issues: ValidationIssue[] = [];

  for (const task of tasks) {
    if (color.get(task.title) === WHITE) {
      detectCycleDFS(task.title, adj, taskTitles, color, [], reportedCycles, issues);
    }
  }

  return issues;
}

/**
 * Recursive DFS visitor. Tracks the current path to reconstruct the
 * cycle when a back-edge is found.
 */
function detectCycleDFS(
  node: string,
  adj: Map<string, readonly string[]>,
  taskTitles: Set<string>,
  color: Map<string, number>,
  path: readonly string[],
  reportedCycles: Set<string>,
  issues: ValidationIssue[],
): void {
  const GRAY = 1;
  const BLACK = 2;

  color.set(node, GRAY);
  const currentPath = [...path, node];
  const deps = adj.get(node) ?? [];

  for (const dep of deps) {
    if (!taskTitles.has(dep)) continue; // skip non-existent tasks

    if (color.get(dep) === GRAY) {
      // Found a cycle — extract it
      const cycleStart = currentPath.indexOf(dep);
      const cycle = [...currentPath.slice(cycleStart), dep];
      const cycleKey = normalizeCycleKey(cycle);

      if (!reportedCycles.has(cycleKey)) {
        reportedCycles.add(cycleKey);
        issues.push({
          severity: 'error',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          taskTitle: cycle[0],
        });
      }
    } else if (color.get(dep) !== BLACK) {
      detectCycleDFS(dep, adj, taskTitles, color, currentPath, reportedCycles, issues);
    }
  }

  color.set(node, BLACK);
}

/**
 * Produces a canonical key for a cycle so the same cycle isn't
 * reported multiple times regardless of which node we enter from.
 */
function normalizeCycleKey(cycle: readonly string[]): string {
  // The cycle array is like [A, B, C, A].  Drop the trailing duplicate.
  const nodes = cycle.slice(0, -1);
  // Rotate so the lexicographically smallest node comes first.
  const minIndex = nodes.indexOf(
    [...nodes].sort()[0],
  );
  const rotated = [...nodes.slice(minIndex), ...nodes.slice(0, minIndex)];
  return rotated.join(' → ');
}
