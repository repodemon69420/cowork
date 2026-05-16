import { Task, TaskPriority, TaskStatus, TaskType } from './types.js';

const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const VALID_TYPES: TaskType[] = ['code', 'research', 'docs', 'refactor', 'test', 'design'];

function parseStatus(marker: string): TaskStatus {
  if (marker === 'x') return 'completed';
  if (marker === '!') return 'failed';
  return 'pending';
}

function parsePriority(value: string): TaskPriority {
  const lower = value.toLowerCase() as TaskPriority;
  return VALID_PRIORITIES.includes(lower) ? lower : 'medium';
}

function parseType(value: string): TaskType {
  const lower = value.toLowerCase() as TaskType;
  return VALID_TYPES.includes(lower) ? lower : 'code';
}

function extractField(lines: string[], field: string): string {
  for (const line of lines) {
    const match = line.match(new RegExp(`^\\s*(?:-\\s*)?\\*\\*${field}:\\*\\*\\s*(.+)`, 'i'))
      || line.match(new RegExp(`^\\s*(?:-\\s*)?\\*\\*${field}\\*\\*:\\s*(.+)`, 'i'));
    if (match) return match[1].trim();
  }
  return '';
}

function extractDependsOn(lines: string[]): string[] | undefined {
  for (const line of lines) {
    const match = line.match(/^\s*(?:-\s*)?\*\*(depends\s*on|dependsOn|dependencies):\*\*\s*(.+)/i)
      || line.match(/^\s*(?:-\s*)?\*\*(depends\s*on|dependsOn|dependencies)\*\*:\s*(.+)/i);
    if (match) {
      return match[2].split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return undefined;
}

export function parseTasksFile(content: string): Task[] {
  const tasks: Task[] = [];
  const sections = content.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0];

    const headerMatch = header.match(/^\[([ x!])\]\s+(.+)/);
    if (!headerMatch) continue;

    const status = parseStatus(headerMatch[1]);
    const title = headerMatch[2].trim();
    const bodyLines = lines.slice(1);

    const priority = parsePriority(extractField(bodyLines, 'priority'));
    const type = parseType(extractField(bodyLines, 'type'));
    const context = extractField(bodyLines, 'context') || '';
    const dependsOn = extractDependsOn(bodyLines);

    const task: Task = { title, priority, type, context, status };
    if (dependsOn && dependsOn.length > 0) {
      task.dependsOn = dependsOn;
    }

    tasks.push(task);
  }

  return tasks;
}
