import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Task } from './types.js';
import { TaskExecutor } from './runner.js';

const execAsync = promisify(exec);

export interface ShellExecutorOptions {
  timeout?: number;
  shell?: string;
  env?: Record<string, string>;
  cwd?: string;
}

const DEFAULT_TIMEOUT = 60000;
const DEFAULT_SHELL = '/bin/sh';

export function createShellExecutor(options?: ShellExecutorOptions): TaskExecutor {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const shell = options?.shell ?? DEFAULT_SHELL;
  const env = { ...process.env, ...options?.env };
  const cwd = options?.cwd;

  return async (task: Task): Promise<{ success: boolean; error?: string }> => {
    const command = task.context;

    try {
      await execAsync(command, { timeout, shell, env, cwd });
      return { success: true };
    } catch (err: unknown) {
      const execError = err as {
        killed?: boolean;
        stderr?: string;
        message?: string;
      };

      if (execError.killed) {
        return { success: false, error: `Command timed out after ${timeout}ms` };
      }

      const errorMessage = execError.stderr || execError.message || 'Unknown error';
      return { success: false, error: errorMessage };
    }
  };
}
