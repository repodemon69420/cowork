import { describe, it, expect, vi } from 'vitest';
import { executePlan, TaskRunner, ExecutorConfig } from './executor.js';
import { Task, ExecutionBatch } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Default task',
    priority: 'medium',
    type: 'code',
    context: '',
    status: 'pending',
    ...overrides,
  };
}

function makeBatch(
  tasks: Task[],
  parallel = false,
): ExecutionBatch {
  return { tasks, parallel };
}

describe('executePlan', () => {
  it('single batch with one task that succeeds', async () => {
    const task = makeTask({ title: 'Task A' });
    const runner: TaskRunner = vi.fn(async () => {});
    const batches = [makeBatch([task])];

    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Task A');
    expect(result.completed[0].status).toBe('completed');
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('single batch with one task that fails', async () => {
    const task = makeTask({ title: 'Task A' });
    const runner: TaskRunner = vi.fn(async () => {
      throw new Error('boom');
    });
    const batches = [makeBatch([task])];

    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Task A');
    expect(result.failed[0].status).toBe('failed');
  });

  it('parallel batch runs tasks concurrently', async () => {
    const taskA = makeTask({ title: 'Task A' });
    const taskB = makeTask({ title: 'Task B' });
    const order: string[] = [];

    const runner: TaskRunner = vi.fn(async (task: Task) => {
      order.push(`start:${task.title}`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`end:${task.title}`);
    });

    const batches = [makeBatch([taskA, taskB], true)];
    await executePlan(batches, runner);

    expect(order[0]).toBe('start:Task A');
    expect(order[1]).toBe('start:Task B');
  });

  it('sequential batch runs tasks one at a time', async () => {
    const taskA = makeTask({ title: 'Task A' });
    const taskB = makeTask({ title: 'Task B' });
    const order: string[] = [];

    const runner: TaskRunner = vi.fn(async (task: Task) => {
      order.push(`start:${task.title}`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`end:${task.title}`);
    });

    const batches = [makeBatch([taskA, taskB], false)];
    await executePlan(batches, runner);

    expect(order).toEqual([
      'start:Task A',
      'end:Task A',
      'start:Task B',
      'end:Task B',
    ]);
  });

  it('timeout aborts long-running tasks', async () => {
    const task = makeTask({ title: 'Slow task' });
    let receivedSignal: AbortSignal | undefined;

    const runner: TaskRunner = vi.fn(async (_task: Task, signal: AbortSignal) => {
      receivedSignal = signal;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    });

    const config: Partial<ExecutorConfig> = { taskTimeoutMs: 50 };
    const batches = [makeBatch([task])];
    const result = await executePlan(batches, runner, config);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Slow task');
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('concurrency limit restricts parallel execution', async () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      makeTask({ title: `Task ${i}` }),
    );
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const runner: TaskRunner = vi.fn(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 20));
      currentConcurrent--;
    });

    const config: Partial<ExecutorConfig> = { concurrencyLimit: 2 };
    const batches = [makeBatch(tasks, true)];
    await executePlan(batches, runner, config);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(runner).toHaveBeenCalledTimes(6);
  });

  it('batch failure skips remaining batches', async () => {
    const batch1Tasks = [makeTask({ title: 'Fail A' }), makeTask({ title: 'Fail B' })];
    const batch2Tasks = [makeTask({ title: 'Should be skipped' })];

    const runner: TaskRunner = vi.fn(async () => {
      throw new Error('fail');
    });

    const batches = [
      makeBatch(batch1Tasks, true),
      makeBatch(batch2Tasks),
    ];
    const result = await executePlan(batches, runner);

    expect(result.failed).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].title).toBe('Should be skipped');
    expect(result.skipped[0].status).toBe('skipped');
  });

  it('empty batches returns empty result', async () => {
    const runner: TaskRunner = vi.fn(async () => {});
    const result = await executePlan([], runner);

    expect(result.completed).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(runner).not.toHaveBeenCalled();
  });

  it('mixed results: some succeed and some fail in same batch', async () => {
    const taskA = makeTask({ title: 'Success' });
    const taskB = makeTask({ title: 'Failure' });

    const runner: TaskRunner = vi.fn(async (task: Task) => {
      if (task.title === 'Failure') {
        throw new Error('oops');
      }
    });

    const batches = [makeBatch([taskA, taskB], true)];
    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Success');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Failure');
  });

  it('returned SessionResult has correct startTime and endTime', async () => {
    const before = new Date();
    const task = makeTask({ title: 'Timed task' });

    const runner: TaskRunner = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const batches = [makeBatch([task])];
    const result = await executePlan(batches, runner);
    const after = new Date();

    expect(result.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(result.endTime.getTime()).toBeGreaterThanOrEqual(result.startTime.getTime());
  });

  it('does not mutate original task objects', async () => {
    const task = makeTask({ title: 'Original' });
    const runner: TaskRunner = vi.fn(async () => {});
    const batches = [makeBatch([task])];

    await executePlan(batches, runner);

    expect(task.status).toBe('pending');
  });

  it('partial batch failure does not skip remaining batches', async () => {
    const batch1Tasks = [
      makeTask({ title: 'Succeed' }),
      makeTask({ title: 'Fail' }),
    ];
    const batch2Tasks = [makeTask({ title: 'Should run' })];

    const runner: TaskRunner = vi.fn(async (task: Task) => {
      if (task.title === 'Fail') {
        throw new Error('oops');
      }
    });

    const batches = [
      makeBatch(batch1Tasks, true),
      makeBatch(batch2Tasks),
    ];
    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('passes AbortSignal to runner', async () => {
    const task = makeTask({ title: 'Signal check' });
    let receivedSignal: AbortSignal | undefined;

    const runner: TaskRunner = vi.fn(async (_task: Task, signal: AbortSignal) => {
      receivedSignal = signal;
    });

    const batches = [makeBatch([task])];
    await executePlan(batches, runner);

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });
});
