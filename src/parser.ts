import { Task, TaskPriority, TaskStatus, TaskType, ParseResult, ValidationWarning } from './types.js';

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

function collectWarnings(
  title: string,
  rawPriority: string,
  resolvedPriority: TaskPriority,
  rawType: string,
  resolvedType: TaskType,
  context: string,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (rawPriority === '') {
    warnings.push({
      taskTitle: title,
      field: 'priority',
      message: `Missing priority, defaulting to '${resolvedPriority}'`,
    });
  } else if (rawPriority.toLowerCase() !== resolvedPriority) {
    warnings.push({
      taskTitle: title,
      field: 'priority',
      message: `Unrecognized priority '${rawPriority}', defaulting to '${resolvedPriority}'`,
    });
  }

  if (rawType === '') {
    warnings.push({
      taskTitle: title,
      field: 'type',
      message: `Missing type, defaulting to '${resolvedType}'`,
    });
  } else if (rawType.toLowerCase() !== resolvedType) {
    warnings.push({
      taskTitle: title,
      field: 'type',
      message: `Unrecognized type '${rawType}', defaulting to '${resolvedType}'`,
    });
  }

  if (context === '') {
    warnings.push({
      taskTitle: title,
      field: 'context',
      message: 'Context is empty',
    });
  }

  return warnings;
}

function collectDependencyWarnings(
  tasks: readonly Task[],
): ValidationWarning[] {
  const titleSet = new Set(tasks.map(t => t.title));
  const warnings: ValidationWarning[] = [];

  for (const task of tasks) {
    if (task.dependsOn) {
      for (const dep of task.dependsOn) {
        if (!titleSet.has(dep)) {
          warnings.push({
            taskTitle: task.title,
            field: 'dependsOn',
            message: `Dependency '${dep}' does not match any task title`,
          });
        }
      }
    }
  }

  return warnings;
}

function collectDuplicateTitleWarnings(
  tasks: readonly Task[],
): ValidationWarning[] {
  const seen = new Set<string>();
  const warnings: ValidationWarning[] = [];

  for (const task of tasks) {
    if (seen.has(task.title)) {
      warnings.push({
        taskTitle: task.title,
        field: 'title',
        message: `Duplicate task title '${task.title}'`,
      });
    } else {
      seen.add(task.title);
    }
  }

  return warnings;
}

export function parseTasksFile(content: string): ParseResult {
  const tasks: Task[] = [];
  const warnings: ValidationWarning[] = [];
  const sections = content.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0];

    const headerMatch = header.match(/^\[([ x!])\]\s+(.+)/);
    if (!headerMatch) continue;

    const status = parseStatus(headerMatch[1]);
    const title = headerMatch[2].trim();
    const bodyLines = lines.slice(1);

    const rawPriority = extractField(bodyLines, 'priority');
    const rawType = extractField(bodyLines, 'type');
    const priority = parsePriority(rawPriority);
    const type = parseType(rawType);
    const context = extractField(bodyLines, 'context') || '';
    const dependsOn = extractDependsOn(bodyLines);

    warnings.push(...collectWarnings(title, rawPriority, priority, rawType, type, context));

    const task: Task = { title, priority, type, context, status };
    if (dependsOn && dependsOn.length > 0) {
      task.dependsOn = dependsOn;
    }

    tasks.push(task);
  }

  warnings.push(...collectDuplicateTitleWarnings(tasks));
  warnings.push(...collectDependencyWarnings(tasks));

  return { tasks, warnings };
}

export function parseTasksFileSimple(content: string): Task[] {
  return parseTasksFile(content).tasks;
}
