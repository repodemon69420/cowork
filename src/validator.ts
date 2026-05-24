import { Task } from './types.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  taskTitle: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateTasks(tasks: Task[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const titleSet = new Set<string>();
  const allTitles = new Set(tasks.map(t => t.title));

  for (const task of tasks) {
    if (!task.title || task.title.trim() === '') {
      issues.push({ level: 'warning', message: 'Task has empty title', taskTitle: task.title });
    }
    if (task.context === '') {
      issues.push({ level: 'warning', message: 'Task has empty context', taskTitle: task.title });
    }
    if (titleSet.has(task.title)) {
      issues.push({ level: 'error', message: `Duplicate title: "${task.title}"`, taskTitle: task.title });
    } else {
      titleSet.add(task.title);
    }
    if (task.dependsOn) {
      for (const dep of task.dependsOn) {
        if (dep === task.title) {
          issues.push({ level: 'error', message: 'Task depends on itself', taskTitle: task.title });
        } else if (!allTitles.has(dep)) {
          issues.push({ level: 'error', message: `Missing dependency: "${dep}"`, taskTitle: task.title });
        }
      }
    }
  }

  return { valid: issues.every(i => i.level !== 'error'), issues };
}
