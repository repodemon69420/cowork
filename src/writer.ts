import { Task, TaskStatus } from './types.js';

const STATUS_MARKERS: Record<TaskStatus, string> = {
  pending: ' ',
  completed: 'x',
  failed: '!',
  skipped: '-',
};

const DEFAULT_HEADER = [
  '# Status: ON',
  '',
  '# Nightly Task Queue',
  '',
  '> Add tasks below before sleeping. The orchestrator processes these top-to-bottom,',
  '> running independent tasks in parallel. Mark completed tasks with [x].',
  '',
  '---',
].join('\n');

const TASK_SEPARATOR = '\n\n---\n\n';

export function serializeTask(task: Task): string {
  const marker = STATUS_MARKERS[task.status];
  const lines: string[] = [
    `## [${marker}] ${task.title}`,
    `**Priority:** ${task.priority}`,
    `**Type:** ${task.type}`,
    `**Context:** ${task.context}`,
  ];

  if (task.dependsOn && task.dependsOn.length > 0) {
    lines.push(`**Depends on:** ${task.dependsOn.join(', ')}`);
  }

  return lines.join('\n');
}

export function serializeTasks(tasks: Task[], header?: string): string {
  const resolvedHeader = header ?? DEFAULT_HEADER;

  if (tasks.length === 0) {
    return resolvedHeader + '\n';
  }

  const serializedTasks = tasks.map(serializeTask);
  return resolvedHeader + TASK_SEPARATOR + serializedTasks.join(TASK_SEPARATOR) + '\n';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function updateTaskStatus(
  content: string,
  title: string,
  newStatus: TaskStatus,
): string {
  const escapedTitle = escapeRegExp(title);
  const pattern = new RegExp(`(## \\[)[ x!\\-](\\] ${escapedTitle})(?=\\n|$)`);
  const match = content.match(pattern);

  if (!match) {
    throw new Error(`Task not found: ${title}`);
  }

  const marker = STATUS_MARKERS[newStatus];
  return content.replace(pattern, `$1${marker}$2`);
}
