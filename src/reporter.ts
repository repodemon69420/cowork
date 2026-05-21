import { Task, SessionResult } from './types.js';

function statusEmoji(status: string): string {
  if (status === 'completed') return '[x]';
  if (status === 'failed') return '[!]';
  return '[ ]';
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  return `${remainingMinutes}m`;
}

export function formatTaskSection(task: Task): string {
  const marker = statusEmoji(task.status);
  const lines: string[] = [
    `## ${marker} ${task.title}`,
    `- **type**: ${task.type}`,
    `- **priority**: ${task.priority}`,
  ];
  if (task.context) {
    lines.push(`- **context**: ${task.context}`);
  }
  return lines.join('\n');
}

export function generateJsonReport(result: SessionResult, commits: string[]): string {
  const duration = formatDuration(result.startTime, result.endTime);
  const totalTasks = result.completed.length + result.failed.length + result.skipped.length;

  const report = {
    summary: {
      duration,
      totalTasks,
      completed: result.completed.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
    },
    tasks: {
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
    },
    commits: [...commits],
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(report, null, 2);
}

export function generateReport(result: SessionResult, commits: string[]): string {
  const duration = formatDuration(result.startTime, result.endTime);
  const total = result.completed.length + result.failed.length + result.skipped.length;
  const lines: string[] = [
    '# Overnight Session Report',
    '',
    `**Duration**: ${duration}`,
    `**Tasks**: ${result.completed.length}/${total} completed`,
    '',
  ];

  if (result.completed.length > 0) {
    lines.push('## Completed', '');
    for (const task of result.completed) {
      lines.push(formatTaskSection(task), '');
    }
  }

  if (result.failed.length > 0) {
    lines.push('## Failed', '');
    for (const task of result.failed) {
      lines.push(formatTaskSection(task), '');
    }
  }

  if (result.skipped.length > 0) {
    lines.push('## Skipped', '');
    for (const task of result.skipped) {
      lines.push(formatTaskSection(task), '');
    }
  }

  if (commits.length > 0) {
    lines.push('## Commits', '');
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
