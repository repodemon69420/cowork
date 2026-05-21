import { parseTasksFileSimple } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport, generateJsonReport } from './reporter.js';
import { SessionResult, Task } from './types.js';

function formatBatchSummary(batchIndex: number, tasks: Task[], parallel: boolean, circular?: boolean): string {
  const mode = circular ? 'CIRCULAR' : parallel ? 'parallel' : 'sequential';
  const header = `Batch ${batchIndex + 1} (${mode}):`;
  const taskLines = tasks.map(t => `  - [${t.priority}] ${t.title} (${t.type})`);
  return [header, ...taskLines].join('\n');
}

export function runHandler(fileContent: string): string {
  const tasks = parseTasksFileSimple(fileContent);

  if (tasks.length === 0) {
    return 'No tasks found in file.';
  }

  const batches = buildExecutionPlan(tasks);

  if (batches.length === 0) {
    return 'No pending tasks to execute.';
  }

  const lines = ['Execution Plan', '==============', ''];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    lines.push(formatBatchSummary(i, batch.tasks, batch.parallel, batch.circular));
    lines.push('');
  }

  const totalTasks = batches.reduce((sum, b) => sum + b.tasks.length, 0);
  lines.push(`Total: ${totalTasks} task(s) in ${batches.length} batch(es)`);

  return lines.join('\n');
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

export function statusHandler(fileContent: string): string {
  const tasks = parseTasksFileSimple(fileContent);

  if (tasks.length === 0) {
    return 'No tasks found in file.';
  }

  const headers = { title: 'Title', status: 'Status', priority: 'Priority', deps: 'Dependencies' };
  const rows = tasks.map(t => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    deps: t.dependsOn ? t.dependsOn.join(', ') : '-',
  }));

  const colWidths = {
    title: Math.max(headers.title.length, ...rows.map(r => r.title.length)),
    status: Math.max(headers.status.length, ...rows.map(r => r.status.length)),
    priority: Math.max(headers.priority.length, ...rows.map(r => r.priority.length)),
    deps: Math.max(headers.deps.length, ...rows.map(r => r.deps.length)),
  };

  const headerLine = `${padRight(headers.title, colWidths.title)} | ${padRight(headers.status, colWidths.status)} | ${padRight(headers.priority, colWidths.priority)} | ${padRight(headers.deps, colWidths.deps)}`;
  const separator = `${'-'.repeat(colWidths.title)} | ${'-'.repeat(colWidths.status)} | ${'-'.repeat(colWidths.priority)} | ${'-'.repeat(colWidths.deps)}`;
  const dataLines = rows.map(r =>
    `${padRight(r.title, colWidths.title)} | ${padRight(r.status, colWidths.status)} | ${padRight(r.priority, colWidths.priority)} | ${padRight(r.deps, colWidths.deps)}`,
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

function parseSessionResult(json: unknown): SessionResult {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid SessionResult: expected an object');
  }

  const obj = json as Record<string, unknown>;

  const parseTaskArray = (field: string): Task[] => {
    const arr = obj[field];
    if (!Array.isArray(arr)) return [];
    return arr as Task[];
  };

  const startTime = new Date(obj['startTime'] as string);
  const endTime = new Date(obj['endTime'] as string);

  if (isNaN(startTime.getTime())) {
    throw new Error('Invalid SessionResult: startTime is not a valid date');
  }
  if (isNaN(endTime.getTime())) {
    throw new Error('Invalid SessionResult: endTime is not a valid date');
  }

  return {
    completed: parseTaskArray('completed'),
    failed: parseTaskArray('failed'),
    skipped: parseTaskArray('skipped'),
    startTime,
    endTime,
  };
}

export function reportHandler(jsonInput: string, format?: 'markdown' | 'json'): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch {
    throw new Error('Invalid JSON input: unable to parse');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid JSON input: expected an object');
  }

  const obj = parsed as Record<string, unknown>;
  const commits = Array.isArray(obj['commits'])
    ? (obj['commits'] as string[])
    : [];

  const result = parseSessionResult(obj['result'] ?? parsed);

  if (format === 'json') {
    return generateJsonReport(result, commits);
  }

  return generateReport(result, commits);
}
