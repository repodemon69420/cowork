import { describe, it, expect } from 'vitest';
import { executePlan, TaskExecutor } from './runner.js';
import { Task, ExecutionBatch } from './types.js';

function makeTask(title: string, overrides?: Partial<Task>): Task {
  return {
    title,
    priority: 'medium',
    type: 'code',
    context: `Context for ${title}`,
    status: 'pending',
    ...overrides,
  };
}

describe('executePlan', () => {
  it('should return empty results for empty batches', async () => {
    const executor: TaskExecutor = async () => ({ success: true });
    const result = await executePlan([], executor);

    expect(result.completed).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.endTime.getTime()).toBeGreaterThanOrEqual(result.startTime.getTime());
  });

  it('should handle all tasks succeeding', async () => {
    const tasks = [makeTask('Task A'), makeTask('Task B'), makeTask('Task C')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: false }];
    const executor: TaskExecutor = async () => ({ success: true });

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.completed.every((t) => t.status === 'completed')).toBe(true);
  });

  it('should handle all tasks failing', async () => {
    const tasks = [makeTask('Task A'), makeTask('Task B')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: false }];
    const executor: TaskExecutor = async () => ({ success: false, error: 'Something went wrong' });

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed.every((t) => t.status === 'failed')).toBe(true);
  });

  it('should handle mixed results', async () => {
    const tasks = [makeTask('Pass'), makeTask('Fail'), makeTask('Pass 2')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: false }];
    const executor: TaskExecutor = async (task) => {
      if (task.title.startsWith('Pass')) {
        return { success: true };
      }
      return { success: false, error: 'failed' };
    };

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.completed.map((t) => t.title)).toEqual(['Pass', 'Pass 2']);
    expect(result.failed.map((t) => t.title)).toEqual(['Fail']);
  });

  it('should run parallel batches concurrently', async () => {
    const tasks = [makeTask('A'), makeTask('B'), makeTask('C')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: true }];

    const startTimes: number[] = [];
    const executor: TaskExecutor = async () => {
      startTimes.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    };

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(3);
    // All tasks should have started within a small window (concurrently)
    const maxDiff = Math.max(...startTimes) - Math.min(...startTimes);
    expect(maxDiff).toBeLessThan(30);
  });

  it('should run sequential batches one at a time', async () => {
    const tasks = [makeTask('A'), makeTask('B'), makeTask('C')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: false }];

    const timestamps: number[] = [];
    const executor: TaskExecutor = async () => {
      timestamps.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    };

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(3);
    // Each subsequent task should start after the previous one finishes
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(40);
    }
  });

  it('should process multiple batches in order', async () => {
    const batch1: ExecutionBatch = { tasks: [makeTask('Batch1-A'), makeTask('Batch1-B')], parallel: true };
    const batch2: ExecutionBatch = { tasks: [makeTask('Batch2-A')], parallel: false };
    const batches = [batch1, batch2];

    const order: string[] = [];
    const executor: TaskExecutor = async (task) => {
      order.push(task.title);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { success: true };
    };

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(3);
    // Batch2-A should come after both Batch1 tasks
    const batch2Index = order.indexOf('Batch2-A');
    expect(batch2Index).toBe(2);
  });

  it('should not mutate original task objects', async () => {
    const originalTask = makeTask('Immutable');
    const batches: ExecutionBatch[] = [{ tasks: [originalTask], parallel: false }];
    const executor: TaskExecutor = async () => ({ success: true });

    await executePlan(batches, executor);

    expect(originalTask.status).toBe('pending');
  });

  it('should handle batches with empty task arrays', async () => {
    const batches: ExecutionBatch[] = [
      { tasks: [], parallel: true },
      { tasks: [makeTask('Only Task')], parallel: false },
      { tasks: [], parallel: false },
    ];
    const executor: TaskExecutor = async () => ({ success: true });

    const result = await executePlan(batches, executor);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Only Task');
  });

  it('should handle executor throwing an error as a failure', async () => {
    const tasks = [makeTask('Throw')];
    const batches: ExecutionBatch[] = [{ tasks, parallel: false }];
    const executor: TaskExecutor = async () => {
      throw new Error('Unexpected crash');
    };

    const result = await executePlan(batches, executor);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Throw');
    expect(result.failed[0].status).toBe('failed');
  });

  it('should record correct start and end times', async () => {
    const batches: ExecutionBatch[] = [
      { tasks: [makeTask('Slow')], parallel: false },
    ];
    const executor: TaskExecutor = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    };

    const before = new Date();
    const result = await executePlan(batches, executor);
    const after = new Date();

    expect(result.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(result.endTime.getTime() - result.startTime.getTime()).toBeGreaterThanOrEqual(40);
  });
});
