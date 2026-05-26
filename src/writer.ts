import { Task, TaskStatus } from './types.js';

const HEADER = '# Status: ON\n\n# Nightly Task Queue\n\n> Add tasks below...\n\n---\n';

function statusMarker(status: TaskStatus): string {
  if (status === 'completed') return 'x';
  if (status === 'failed') return '!';
  return ' ';
}

function serializeTask(task: Task): string {
  const marker = statusMarker(task.status);
  let block = `\n## [${marker}] ${task.title}\n`;
  block += `**Priority:** ${task.priority}\n`;
  block += `**Type:** ${task.type}\n`;
  block += `**Context:** ${task.context}\n`;
  if (task.dependsOn && task.dependsOn.length > 0) {
    block += `**Depends on:** ${task.dependsOn.join(', ')}\n`;
  }
  block += '\n---\n';
  return block;
}

export function serializeTasks(tasks: Task[]): string {
  let output = HEADER;
  for (const task of tasks) {
    output += serializeTask(task);
  }
  return output;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function updateTaskStatus(
  content: string,
  title: string,
  newStatus: TaskStatus,
): string {
  const escapedTitle = escapeRegex(title);
  const pattern = new RegExp(
    `(## \\[)[ x!](\\] ${escapedTitle})`,
  );
  const marker = statusMarker(newStatus);
  return content.replace(pattern, `$1${marker}$2`);
}

export function appendTasks(content: string, newTasks: Task[]): string {
  const serialized = newTasks.map(t => serializeTask(t)).join('');

  const commentMatch = content.match(/\n*<!--/);
  if (commentMatch && commentMatch.index !== undefined) {
    const before = content.slice(0, commentMatch.index);
    const after = content.slice(commentMatch.index);
    return before + serialized + after;
  }

  return content + serialized;
}
