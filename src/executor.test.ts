import { describe, it, expect } from 'vitest';
import { executeTask, executeBatch, executePlan, TaskRunner } from './executor.js';
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('executeTask', () => {
  it('success: runner returns completed, task status updated', async () => {
    const task = makeTask({ title: 'My task' });
    const runner: TaskRunner = async () => 'completed';

    const result = await executeTask(task, runner);

    expect(result.status).toBe('completed');
    expect(result.title).toBe('My task');
  });

  it('failure: runner returns failed, task status updated', async () => {
    const task = makeTask({ title: 'Failing task' });
    const runner: TaskRunner = async () => 'failed';

    const result = await executeTask(task, runner);

    expect(result.status).toBe('failed');
    expect(result.title).toBe('Failing task');
  });

  it('runner throws: task gets failed status', async () => {
    const task = makeTask({ title: 'Throwing task' });
    const runner: TaskRunner = async () => {
      throw new Error('kaboom');
    };

    const result = await executeTask(task, runner);

    expect(result.status).toBe('failed');
    expect(result.title).toBe('Throwing task');
  });

  it('immutability: original task is not modified', async () => {
    const task = makeTask({ title: 'Original', status: 'pending' });
    const runner: TaskRunner = async () => 'completed';

    const result = await executeTask(task, runner);

    expect(task.status).toBe('pending');
    expect(result.status).toBe('completed');
    expect(result).not.toBe(task);
  });
});

describe('executeBatch', () => {
  it('parallel: all tasks run concurrently', async () => {
    const timestamps: { title: string; start: number }[] = [];

    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
      makeTask({ title: 'C' }),
    ];
    const batch: ExecutionBatch = { tasks, parallel: true };

    const runner: TaskRunner = async (task) => {
      timestamps.push({ title: task.title, start: Date.now() });
      await delay(30);
      return 'completed';
    };

    const results = await executeBatch(batch, runner);

    expect(results).toHaveLength(3);
    // All tasks should have started within a few ms of each other
    const starts = timestamps.map(t => t.start);
    const maxGap = Math.max(...starts) - Math.min(...starts);
    expect(maxGap).toBeLessThan(15);
  });

  it('sequential: tasks run in order', async () => {
    const finishOrder: string[] = [];

    const tasks = [
      makeTask({ title: 'First' }),
      makeTask({ title: 'Second' }),
      makeTask({ title: 'Third' }),
    ];
    const batch: ExecutionBatch = { tasks, parallel: false };

    const runner: TaskRunner = async (task) => {
      await delay(10);
      finishOrder.push(task.title);
      return 'completed';
    };

    const results = await executeBatch(batch, runner);

    expect(results).toHaveLength(3);
    expect(finishOrder).toEqual(['First', 'Second', 'Third']);
  });

  it('mixed results: some succeed, some fail', async () => {
    const tasks = [
      makeTask({ title: 'Pass' }),
      makeTask({ title: 'Fail' }),
      makeTask({ title: 'Pass again' }),
    ];
    const batch: ExecutionBatch = { tasks, parallel: false };

    const runner: TaskRunner = async (task) => {
      return task.title === 'Fail' ? 'failed' : 'completed';
    };

    const results = await executeBatch(batch, runner);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('completed');
    expect(results[1].status).toBe('failed');
    expect(results[2].status).toBe('completed');
  });
});

describe('executePlan', () => {
  it('single batch: executes and returns correct SessionResult', async () => {
    const batches: ExecutionBatch[] = [
      {
        tasks: [makeTask({ title: 'Only task' })],
        parallel: false,
      },
    ];
    const runner: TaskRunner = async () => 'completed';

    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Only task');
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('multiple batches: runs in order', async () => {
    const order: string[] = [];

    const batches: ExecutionBatch[] = [
      {
        tasks: [makeTask({ title: 'Batch 1 task' })],
        parallel: false,
      },
      {
        tasks: [makeTask({ title: 'Batch 2 task' })],
        parallel: false,
      },
    ];

    const runner: TaskRunner = async (task) => {
      order.push(task.title);
      return 'completed';
    };

    const result = await executePlan(batches, runner);

    expect(order).toEqual(['Batch 1 task', 'Batch 2 task']);
    expect(result.completed).toHaveLength(2);
  });

  it('calls onProgress after each task', async () => {
    const progressCalls: [number, number][] = [];

    const batches: ExecutionBatch[] = [
      {
        tasks: [
          makeTask({ title: 'T1' }),
          makeTask({ title: 'T2' }),
        ],
        parallel: false,
      },
      {
        tasks: [makeTask({ title: 'T3' })],
        parallel: false,
      },
    ];

    const runner: TaskRunner = async () => 'completed';
    const onProgress = (completed: number, total: number) => {
      progressCalls.push([completed, total]);
    };

    await executePlan(batches, runner, onProgress);

    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('records start and end time', async () => {
    const before = new Date();

    const batches: ExecutionBatch[] = [
      {
        tasks: [makeTask({ title: 'Timed task' })],
        parallel: false,
      },
    ];
    const runner: TaskRunner = async () => 'completed';

    const result = await executePlan(batches, runner);

    const after = new Date();

    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(result.endTime.getTime()).toBeGreaterThanOrEqual(result.startTime.getTime());
  });

  it('empty batches: returns empty result', async () => {
    const runner: TaskRunner = async () => 'completed';

    const result = await executePlan([], runner);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
  });

  it('all tasks fail: everything in result.failed', async () => {
    const batches: ExecutionBatch[] = [
      {
        tasks: [
          makeTask({ title: 'Fail 1' }),
          makeTask({ title: 'Fail 2' }),
        ],
        parallel: false,
      },
    ];

    const runner: TaskRunner = async () => 'failed';

    const result = await executePlan(batches, runner);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].title).toBe('Fail 1');
    expect(result.failed[1].title).toBe('Fail 2');
  });
});
