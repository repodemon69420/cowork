import { readFile, writeFile } from 'node:fs/promises';
import type { Task, TaskStatus } from './types.js';

function statusToMarker(status: TaskStatus): string {
  if (status === 'completed') return 'x';
  if (status === 'failed') return '!';
  return ' ';
}

export async function updateTaskStatus(
  filePath: string,
  taskTitle: string,
  newStatus: TaskStatus
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const marker = statusToMarker(newStatus);

  // Match ## [<any status marker>] <title> where title matches exactly
  const escapedTitle = taskTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^(## \\[)[ x!](\\] ${escapedTitle})$`,
    'm'
  );

  if (!pattern.test(content)) {
    throw new Error(`Task not found: "${taskTitle}"`);
  }

  const updated = content.replace(pattern, `$1${marker}$2`);
  await writeFile(filePath, updated, 'utf-8');
}

export async function appendTask(
  filePath: string,
  task: Task
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const marker = statusToMarker(task.status);

  const lines: string[] = [
    '',
    `## [${marker}] ${task.title}`,
    `**Priority:** ${task.priority}`,
    `**Type:** ${task.type}`,
    `**Context:** ${task.context}`,
  ];

  if (task.dependsOn && task.dependsOn.length > 0) {
    lines.push(`**Depends on:** ${task.dependsOn.join(', ')}`);
  }

  lines.push('', '---', '');

  const endsWithNewline = content.endsWith('\n');
  const separator = endsWithNewline ? '' : '\n';
  const appended = content + separator + lines.join('\n');

  await writeFile(filePath, appended, 'utf-8');
}
