import type { Task, TaskStatus } from './types.js';

const STATUS_MAP: Record<TaskStatus, string> = {
  pending: '[ ]',
  completed: '[x]',
  failed: '[!]',
  skipped: '[ ]',
};

const HEADER = '# Status: ON\n\n# Nightly Task Queue\n\n---\n\n';

function serializeTask(task: Task): string {
  const lines: string[] = [];
  lines.push(`## ${STATUS_MAP[task.status]} ${task.title}`);
  lines.push(`**Priority:** ${task.priority}`);
  lines.push(`**Type:** ${task.type}`);
  lines.push(`**Context:** ${task.context}`);
  if (task.dependsOn && task.dependsOn.length > 0) {
    lines.push(`**Depends on:** ${task.dependsOn.join(', ')}`);
  }
  return lines.join('\n');
}

export function serializeTasksFile(tasks: Task[]): string {
  if (tasks.length === 0) return HEADER;
  return HEADER + tasks.map(serializeTask).join('\n\n---\n\n') + '\n';
}
