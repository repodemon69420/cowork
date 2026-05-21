import { describe, it, expect, vi } from 'vitest';
import { TaskExecutor } from './executor.js';
import { Task, ExecutionBatch, TaskRunResult } from './types.js';
import { CoworkConfig } from './config.js';

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

function makeConfig(overrides: Partial<CoworkConfig> = {}): CoworkConfig {
  return {
    tasksFile: './TASKS.md',
    outputFormat: 'markdown',
    logDir: './.cowork/logs',
    concurrency: 4,
    timeout: 5000,
    ...overrides,
  };
}

function successResult(output = 'done'): TaskRunResult {
  return { success: true, output, durationMs: 10 };
}

function failResult(error = 'something went wrong'): TaskRunResult {
  return { success: false, output: '', durationMs: 10, error };
}

describe('TaskExecutor', () => {
  it('single batch with one successful task', async () => {
    const task = makeTask({ title: 'Solo' });
    const batches: ExecutionBatch[] = [{ tasks: [task], parallel: false }];
    const runner = vi.fn().mockResolvedValue(successResult());

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Solo');
    expect(result.completed[0].status).toBe('completed');
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('parallel execution of multiple independent tasks in a batch', async () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
      makeTask({ title: 'C' }),
    ];
    const batches: ExecutionBatch[] = [{ tasks, parallel: true }];

    const callOrder: string[] = [];
    const runner = vi.fn().mockImplementation(async (task: Task) => {
      callOrder.push(task.title);
      return successResult(task.title);
    });

    const executor = new TaskExecutor(makeConfig({ concurrency: 4 }), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(3);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it('sequential batch execution (batch 2 runs after batch 1)', async () => {
    const taskA = makeTask({ title: 'Batch1-Task' });
    const taskB = makeTask({ title: 'Batch2-Task', dependsOn: ['Batch1-Task'] });
    const batches: ExecutionBatch[] = [
      { tasks: [taskA], parallel: false },
      { tasks: [taskB], parallel: false },
    ];

    const callOrder: string[] = [];
    const runner = vi.fn().mockImplementation(async (task: Task) => {
      callOrder.push(task.title);
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(callOrder).toEqual(['Batch1-Task', 'Batch2-Task']);
    expect(result.completed).toHaveLength(2);
  });

  it('task that times out is marked as failed', async () => {
    const task = makeTask({ title: 'Slow task' });
    const batches: ExecutionBatch[] = [{ tasks: [task], parallel: false }];

    const runner = vi.fn().mockImplementation(async () => {
      // Wait longer than the timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig({ timeout: 20 }), runner);
    const result = await executor.execute(batches);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Slow task');
    expect(result.failed[0].status).toBe('failed');
    expect(result.completed).toHaveLength(0);
  });

  it('task that throws an error is marked failed, siblings still complete', async () => {
    const taskA = makeTask({ title: 'Good task' });
    const taskB = makeTask({ title: 'Bad task' });
    const batches: ExecutionBatch[] = [{ tasks: [taskA, taskB], parallel: true }];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Bad task') {
        throw new Error('Kaboom');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig({ concurrency: 4 }), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Good task');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Bad task');
  });

  it('downstream tasks skipped when upstream dependency fails', async () => {
    const upstream = makeTask({ title: 'Upstream' });
    const downstream = makeTask({ title: 'Downstream', dependsOn: ['Upstream'] });
    const batches: ExecutionBatch[] = [
      { tasks: [upstream], parallel: false },
      { tasks: [downstream], parallel: false },
    ];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Upstream') {
        return failResult('upstream failed');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Upstream');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].title).toBe('Downstream');
    expect(result.skipped[0].status).toBe('skipped');
    expect(result.completed).toHaveLength(0);
    // Runner should only have been called for the upstream task
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('SessionResult has correct completed/failed/skipped arrays', async () => {
    const taskA = makeTask({ title: 'Success' });
    const taskB = makeTask({ title: 'Failure' });
    const taskC = makeTask({ title: 'Dependent', dependsOn: ['Failure'] });
    const batches: ExecutionBatch[] = [
      { tasks: [taskA, taskB], parallel: true },
      { tasks: [taskC], parallel: false },
    ];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Failure') {
        return failResult('it broke');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.completed.map(t => t.title)).toEqual(['Success']);
    expect(result.failed.map(t => t.title)).toEqual(['Failure']);
    expect(result.skipped.map(t => t.title)).toEqual(['Dependent']);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.endTime.getTime()).toBeGreaterThanOrEqual(result.startTime.getTime());
  });

  it('concurrency=1 forces serial execution even in parallel batch', async () => {
    const tasks = [
      makeTask({ title: 'T1' }),
      makeTask({ title: 'T2' }),
      makeTask({ title: 'T3' }),
    ];
    const batches: ExecutionBatch[] = [{ tasks, parallel: true }];

    const executing = new Set<string>();
    let maxConcurrent = 0;

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      executing.add(task.title);
      maxConcurrent = Math.max(maxConcurrent, executing.size);
      // Small delay so overlap would be detected if concurrency > 1
      await new Promise(resolve => setTimeout(resolve, 15));
      executing.delete(task.title);
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig({ concurrency: 1 }), runner);
    const result = await executor.execute(batches);

    expect(maxConcurrent).toBe(1);
    expect(result.completed).toHaveLength(3);
  });

  it('empty batch list returns empty session result', async () => {
    const runner = vi.fn();
    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute([]);

    expect(result.completed).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(runner).not.toHaveBeenCalled();
  });

  it('timeout edge case -- task completes just before deadline', async () => {
    const task = makeTask({ title: 'Fast enough' });
    const batches: ExecutionBatch[] = [{ tasks: [task], parallel: false }];

    const runner = vi.fn().mockImplementation(async () => {
      // Complete well within the timeout
      await new Promise(resolve => setTimeout(resolve, 5));
      return successResult('just in time');
    });

    const executor = new TaskExecutor(makeConfig({ timeout: 200 }), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Fast enough');
    expect(result.failed).toHaveLength(0);
  });

  it('all tasks succeed -- all in completed array', async () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
      makeTask({ title: 'C' }),
    ];
    const batches: ExecutionBatch[] = [{ tasks, parallel: true }];
    const runner = vi.fn().mockResolvedValue(successResult());

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    const titles = result.completed.map(t => t.title).sort();
    expect(titles).toEqual(['A', 'B', 'C']);
    result.completed.forEach(t => expect(t.status).toBe('completed'));
  });

  it('mix of success and failure across batches', async () => {
    const batch1Tasks = [
      makeTask({ title: 'B1-Pass' }),
      makeTask({ title: 'B1-Fail' }),
    ];
    const batch2Tasks = [
      makeTask({ title: 'B2-NoDep' }),
      makeTask({ title: 'B2-DepOnFail', dependsOn: ['B1-Fail'] }),
      makeTask({ title: 'B2-DepOnPass', dependsOn: ['B1-Pass'] }),
    ];
    const batches: ExecutionBatch[] = [
      { tasks: batch1Tasks, parallel: true },
      { tasks: batch2Tasks, parallel: true },
    ];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'B1-Fail') {
        return failResult('batch 1 failure');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    // B1-Pass succeeds, B1-Fail fails
    expect(result.completed.map(t => t.title).sort()).toEqual(
      ['B1-Pass', 'B2-DepOnPass', 'B2-NoDep'].sort(),
    );
    expect(result.failed.map(t => t.title)).toEqual(['B1-Fail']);
    expect(result.skipped.map(t => t.title)).toEqual(['B2-DepOnFail']);
  });

  it('does not mutate input batches or tasks', async () => {
    const task = makeTask({ title: 'Immutable' });
    const batches: ExecutionBatch[] = [{ tasks: [task], parallel: false }];
    const batchesCopy = JSON.parse(JSON.stringify(batches));
    const runner = vi.fn().mockResolvedValue(successResult());

    const executor = new TaskExecutor(makeConfig(), runner);
    await executor.execute(batches);

    expect(batches).toEqual(batchesCopy);
  });

  it('multiple failed dependencies cause downstream to be skipped', async () => {
    const taskA = makeTask({ title: 'DepA' });
    const taskB = makeTask({ title: 'DepB' });
    const taskC = makeTask({ title: 'Child', dependsOn: ['DepA', 'DepB'] });
    const batches: ExecutionBatch[] = [
      { tasks: [taskA, taskB], parallel: true },
      { tasks: [taskC], parallel: false },
    ];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'DepA') {
        return failResult('a failed');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    // DepA fails, DepB passes, but Child depends on DepA so it is skipped
    expect(result.failed.map(t => t.title)).toEqual(['DepA']);
    expect(result.completed.map(t => t.title)).toEqual(['DepB']);
    expect(result.skipped.map(t => t.title)).toEqual(['Child']);
  });

  it('task with no dependsOn in later batch still runs after earlier failure', async () => {
    const taskA = makeTask({ title: 'Fails' });
    const taskB = makeTask({ title: 'Independent' });
    const batches: ExecutionBatch[] = [
      { tasks: [taskA], parallel: false },
      { tasks: [taskB], parallel: false },
    ];

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Fails') {
        return failResult('oops');
      }
      return successResult();
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.failed.map(t => t.title)).toEqual(['Fails']);
    expect(result.completed.map(t => t.title)).toEqual(['Independent']);
    expect(result.skipped).toHaveLength(0);
  });
});
