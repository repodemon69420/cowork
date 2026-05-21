import { parseTasksFileSimple } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport, generateJsonReport } from './reporter.js';
import { appendTask } from './writer.js';
import { SessionResult, Task, TaskPriority, TaskType, ProgressEvent } from './types.js';

function formatBatchSummary(batchIndex: number, tasks: Task[], parallel: boolean, circular?: boolean): string {
  const mode = circular ? 'CIRCULAR' : parallel ? 'parallel' : 'sequential';
  const header = `Batch ${batchIndex + 1} (${mode}):`;
  const taskLines = tasks.map(t => `  - [${t.priority}] ${t.title} (${t.type})`);
  return [header, ...taskLines].join('\n');
}

export interface RunHandlerOptions {
  readonly execute?: boolean;
}

export function runHandler(fileContent: string, options: RunHandlerOptions = {}): string {
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

  if (!options.execute) {
    lines.push('');
    lines.push('Dry run complete. Use --execute to run tasks.');
  }

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

export function historyHandler(logs: ReadonlyArray<{ path: string; data: object }>): string {
  if (logs.length === 0) {
    return 'No session logs found.';
  }

  const rows = logs.map((log) => {
    const record = log.data as Record<string, unknown>;
    const summary = (record['summary'] ?? {}) as Record<string, unknown>;
    const generatedAt = typeof record['generatedAt'] === 'string' ? record['generatedAt'] : 'unknown';
    const duration = typeof summary['duration'] === 'string' ? summary['duration'] : '-';
    const completed = typeof summary['completed'] === 'number' ? summary['completed'] : 0;
    const failed = typeof summary['failed'] === 'number' ? summary['failed'] : 0;
    const skipped = typeof summary['skipped'] === 'number' ? summary['skipped'] : 0;

    return {
      date: generatedAt,
      duration,
      completed: String(completed),
      failed: String(failed),
      skipped: String(skipped),
    };
  });

  const headers = { date: 'Date', duration: 'Duration', completed: 'Completed', failed: 'Failed', skipped: 'Skipped' };

  const colWidths = {
    date: Math.max(headers.date.length, ...rows.map((r) => r.date.length)),
    duration: Math.max(headers.duration.length, ...rows.map((r) => r.duration.length)),
    completed: Math.max(headers.completed.length, ...rows.map((r) => r.completed.length)),
    failed: Math.max(headers.failed.length, ...rows.map((r) => r.failed.length)),
    skipped: Math.max(headers.skipped.length, ...rows.map((r) => r.skipped.length)),
  };

  const headerLine = `${padRight(headers.date, colWidths.date)} | ${padRight(headers.duration, colWidths.duration)} | ${padRight(headers.completed, colWidths.completed)} | ${padRight(headers.failed, colWidths.failed)} | ${padRight(headers.skipped, colWidths.skipped)}`;
  const separator = `${'-'.repeat(colWidths.date)} | ${'-'.repeat(colWidths.duration)} | ${'-'.repeat(colWidths.completed)} | ${'-'.repeat(colWidths.failed)} | ${'-'.repeat(colWidths.skipped)}`;
  const dataLines = rows.map((r) =>
    `${padRight(r.date, colWidths.date)} | ${padRight(r.duration, colWidths.duration)} | ${padRight(r.completed, colWidths.completed)} | ${padRight(r.failed, colWidths.failed)} | ${padRight(r.skipped, colWidths.skipped)}`,
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

export interface AddHandlerOptions {
  readonly title: string;
  readonly priority: TaskPriority;
  readonly type: TaskType;
  readonly context: string;
  readonly dependsOn?: string[];
  readonly filePath: string;
}

export async function addHandler(options: AddHandlerOptions): Promise<string> {
  const task: Task = {
    title: options.title,
    priority: options.priority,
    type: options.type,
    context: options.context,
    status: 'pending',
  };

  if (options.dependsOn && options.dependsOn.length > 0) {
    task.dependsOn = options.dependsOn;
  }

  await appendTask(options.filePath, task);

  return `Added task: "${options.title}" to ${options.filePath}`;
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

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

const subcommandHelp: Record<string, string> = {
  run: `cowork run — Parse tasks and display execution plan

Options:
  --file <path>     Path to TASKS.md (default: from config or ./TASKS.md)
  --execute         Actually execute tasks (default: dry run)

Examples:
  cowork run
  cowork run --file ./MY_TASKS.md --execute`,

  status: `cowork status — Print task status table

Options:
  --file <path>     Path to TASKS.md (default: from config or ./TASKS.md)

Examples:
  cowork status
  cowork status --file ./MY_TASKS.md`,

  report: `cowork report — Generate markdown report from session JSON

Options:
  --input <path>    Path to session result JSON (required)
  --format <type>   Output format: markdown or json (default: markdown)

Examples:
  cowork report --input ./session.json
  cowork report --input ./session.json --format json`,

  history: `cowork history — Show session history log

Options:
  --log-dir <path>  Path to log directory (default: from config or ./.cowork/logs)

Examples:
  cowork history
  cowork history --log-dir ./my-logs`,

  add: `cowork add — Add a new task to the tasks file

Options:
  --title <text>       Task title (required)
  --priority <level>   Priority: high, medium, or low (default: medium)
  --type <type>        Task type: code, research, docs, refactor, test, or design (default: code)
  --context <text>     Additional context for the task (default: "")
  --depends-on <list>  Comma-separated list of dependency task titles
  --file <path>        Path to TASKS.md (default: from config or ./TASKS.md)

Examples:
  cowork add --title "Fix login bug" --priority high --type code
  cowork add --title "Write docs" --depends-on "Fix login bug,Build API"`,
};

export function getSubcommandHelp(name: string): string | undefined {
  return subcommandHelp[name];
}

export function createProgressFormatter(): (event: ProgressEvent) => string {
  return (event: ProgressEvent): string => {
    switch (event.type) {
      case 'batch-start':
        return `[batch ${event.batchIndex + 1}] Starting ${event.taskCount} task${event.taskCount === 1 ? '' : 's'}...`;
      case 'task-start':
        return `  Starting: ${event.taskTitle}`;
      case 'task-end': {
        if (event.result.success) {
          return `  [ok] ${event.taskTitle} (${formatDuration(event.result.durationMs)})`;
        }
        const reason = event.result.error ?? 'unknown error';
        return `  [FAIL] ${event.taskTitle} -- ${reason}`;
      }
      case 'batch-end':
        return `[batch ${event.batchIndex + 1}] Done`;
      case 'session-end': {
        const r = event.result;
        const total = r.completed.length + r.failed.length + r.skipped.length;
        return `Session complete: ${r.completed.length}/${total} succeeded, ${r.failed.length} failed, ${r.skipped.length} skipped`;
      }
    }
  };
}
