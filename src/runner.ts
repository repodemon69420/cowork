import { execFile } from 'node:child_process';
import type { TaskRunner } from './executor.js';
import type { Task } from './types.js';

export function createNoopRunner(): TaskRunner {
  return async (_task: Task, _signal: AbortSignal): Promise<void> => {};
}

function buildPrompt(task: Task): string {
  const parts = [
    `Task: ${task.title}`,
    `Type: ${task.type}`,
    `Priority: ${task.priority}`,
  ];
  if (task.context) {
    parts.push(`Context: ${task.context}`);
  }
  return parts.join('\n');
}

export function createProcessRunner(): TaskRunner {
  return async (task: Task, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) {
      throw new Error(`Task "${task.title}" was aborted before starting`);
    }

    const prompt = buildPrompt(task);

    return new Promise<void>((resolve, reject) => {
      const child = execFile(
        'claude',
        ['--print', prompt],
        { timeout: 0 },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          if (error) {
            const nodeErr = error as NodeJS.ErrnoException;
            if (nodeErr.code === 'ENOENT') {
              reject(
                new Error(
                  'Could not find "claude" command. ' +
                    'Ensure Claude CLI is installed and available on PATH.',
                ),
              );
              return;
            }
            reject(
              new Error(
                `Task "${task.title}" failed: ${error.message}`,
              ),
            );
            return;
          }
          resolve();
        },
      );

      function onAbort(): void {
        child.kill();
        reject(new Error(`Task "${task.title}" was aborted`));
      }

      signal.addEventListener('abort', onAbort);
    });
  };
}
