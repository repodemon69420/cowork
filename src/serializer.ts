import { Task, TaskStatus } from './types.js';

const STATUS_MARKERS: Record<TaskStatus, string> = {
  pending: ' ',
  completed: 'x',
  failed: '!',
  skipped: ' ',
};

function statusToMarker(status: TaskStatus): string {
  return STATUS_MARKERS[status];
}

function markerFromStatus(status: TaskStatus): string {
  return `[${statusToMarker(status)}]`;
}

function serializeTask(task: Task): string {
  const marker = markerFromStatus(task.status);
  const lines: string[] = [
    `## ${marker} ${task.title}`,
    `**Priority:** ${task.priority}`,
    `**Type:** ${task.type}`,
    `**Context:** ${task.context}`,
  ];

  if (task.dependsOn && task.dependsOn.length > 0) {
    lines.push(`**Depends on:** ${task.dependsOn.join(', ')}`);
  }

  return lines.join('\n');
}

export function serializeTasks(tasks: readonly Task[]): string {
  if (tasks.length === 0) {
    return '';
  }

  return tasks
    .map((task) => `${serializeTask(task)}\n\n---\n`)
    .join('\n');
}

export function updateTaskStatus(
  content: string,
  title: string,
  newStatus: TaskStatus,
): string {
  const marker = statusToMarker(newStatus);
  const pattern = new RegExp(
    `^(## \\[)[ x!](\\] ${escapeRegExp(title)})$`,
    'm',
  );

  return content.replace(pattern, `$1${marker}$2`);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
