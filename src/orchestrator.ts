import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { parseTasksFile } from './parser.js';
import { validateTasks } from './validator.js';
import { buildExecutionPlan } from './scheduler.js';
import { executePlan, TaskExecutor } from './runner.js';
import { generateReport } from './reporter.js';
import { updateTaskStatus } from './serializer.js';
import { SessionResult } from './types.js';

export interface OrchestrateOptions {
  executor: TaskExecutor;
  cwd?: string;
  onProgress?: (progress: { completed: number; failed: number; total: number }) => void;
}

export interface OrchestrateResult {
  session: SessionResult;
  reportPath: string;
  tasksUpdated: boolean;
}

function createEmptySession(): SessionResult {
  const now = new Date();
  return {
    completed: [],
    failed: [],
    skipped: [],
    startTime: now,
    endTime: now,
  };
}

function wrapExecutorWithProgress(
  executor: TaskExecutor,
  total: number,
  onProgress?: OrchestrateOptions['onProgress'],
): TaskExecutor {
  let completedCount = 0;
  let failedCount = 0;

  return async (task) => {
    const result = await executor(task);
    if (result.success) {
      completedCount++;
    } else {
      failedCount++;
    }
    if (onProgress) {
      onProgress({ completed: completedCount, failed: failedCount, total });
    }
    return result;
  };
}

function writeReport(reportPath: string, session: SessionResult): void {
  const reportContent = generateReport(session, []);
  writeFileSync(reportPath, reportContent, 'utf-8');
}

function updateTasksFileStatuses(
  tasksFilePath: string,
  session: SessionResult,
): boolean {
  let content = readFileSync(tasksFilePath, 'utf-8');

  for (const task of session.completed) {
    content = updateTaskStatus(content, task.title, 'completed');
  }
  for (const task of session.failed) {
    content = updateTaskStatus(content, task.title, 'failed');
  }

  writeFileSync(tasksFilePath, content, 'utf-8');
  return true;
}

export async function orchestrate(options: OrchestrateOptions): Promise<OrchestrateResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);

  const tasksFilePath = resolve(cwd, config.tasksFile);
  const reportPath = resolve(cwd, 'MORNING_REPORT.md');

  // Read and parse tasks
  const content = readFileSync(tasksFilePath, 'utf-8');
  const tasks = parseTasksFile(content);

  // Validate
  const validation = validateTasks(tasks);
  if (!validation.valid) {
    return {
      session: createEmptySession(),
      reportPath,
      tasksUpdated: false,
    };
  }

  // Build execution plan
  const batches = buildExecutionPlan(tasks);
  if (batches.length === 0) {
    return {
      session: createEmptySession(),
      reportPath,
      tasksUpdated: false,
    };
  }

  // Count total pending tasks across all batches
  const total = batches.reduce((sum, batch) => sum + batch.tasks.length, 0);

  // Wrap executor with progress tracking
  const wrappedExecutor = wrapExecutorWithProgress(
    options.executor,
    total,
    options.onProgress,
  );

  // Execute
  const session = await executePlan(batches, wrappedExecutor);

  // Write report
  writeReport(reportPath, session);

  // Update TASKS.md statuses
  const hasChanges = session.completed.length > 0 || session.failed.length > 0;
  let tasksUpdated = false;
  if (hasChanges) {
    tasksUpdated = updateTasksFileStatuses(tasksFilePath, session);
  }

  return { session, reportPath, tasksUpdated };
}
