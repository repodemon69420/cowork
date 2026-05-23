import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from './types.js';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile,
}));

import { createNoopRunner, createProcessRunner } from './runner.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Test task',
    priority: 'medium',
    type: 'code',
    context: 'Do something useful',
    status: 'pending',
    ...overrides,
  };
}

describe('createNoopRunner', () => {
  it('resolves successfully without doing anything', async () => {
    const runner = createNoopRunner();
    const task = makeTask();
    const controller = new AbortController();

    await expect(runner(task, controller.signal)).resolves.toBeUndefined();
  });

  it('resolves for multiple tasks', async () => {
    const runner = createNoopRunner();
    const controller = new AbortController();

    await expect(runner(makeTask({ title: 'A' }), controller.signal)).resolves.toBeUndefined();
    await expect(runner(makeTask({ title: 'B' }), controller.signal)).resolves.toBeUndefined();
  });
});

describe('createProcessRunner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles pre-aborted signal by rejecting', async () => {
    const runner = createProcessRunner();
    const task = makeTask({ title: 'Abort me' });
    const controller = new AbortController();
    controller.abort();

    await expect(runner(task, controller.signal)).rejects.toThrow('aborted before starting');
  });

  it('fails gracefully when claude command is not found', async () => {
    mocks.execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        const error = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        cb(error);
        return { kill: vi.fn() };
      },
    );

    const runner = createProcessRunner();
    const task = makeTask({ title: 'Missing command' });
    const controller = new AbortController();

    await expect(runner(task, controller.signal)).rejects.toThrow(/claude/i);
  });

  it('rejects with task failure message on non-ENOENT errors', async () => {
    mocks.execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('process exited with code 1'));
        return { kill: vi.fn() };
      },
    );

    const runner = createProcessRunner();
    const task = makeTask({ title: 'Failing task' });
    const controller = new AbortController();

    await expect(runner(task, controller.signal)).rejects.toThrow('Failing task');
  });

  it('resolves on successful execution', async () => {
    mocks.execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(null);
        return { kill: vi.fn() };
      },
    );

    const runner = createProcessRunner();
    const task = makeTask({ title: 'Success task' });
    const controller = new AbortController();

    await expect(runner(task, controller.signal)).resolves.toBeUndefined();
  });

  it('returns a function with TaskRunner signature', () => {
    const runner = createProcessRunner();
    expect(typeof runner).toBe('function');
  });
});
