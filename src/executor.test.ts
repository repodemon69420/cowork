import { describe, it, expect, vi } from 'vitest';
import { TaskExecutor } from './executor.js';
import { Task, ExecutionBatch, TaskRunResult } from './types.js';
import { CoworkConfig, resolveConfig } from './config.js';
import { parseTasksFileSimple } from './parser.js';
import { buildExecutionPlan } from './scheduler.js';
import { generateReport, generateJsonReport } from './reporter.js';

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

describe('TaskExecutor integration', () => {
  it('full pipeline: parse TASKS.md -> build plan -> execute -> verify SessionResult', async () => {
    const tasksContent = [
      '## [ ] Set up database',
      '- **Priority:** high',
      '- **Type:** code',
      '- **Context:** Initialize the database schema',
      '',
      '## [ ] Write API endpoints',
      '- **Priority:** medium',
      '- **Type:** code',
      '- **Context:** REST API for the app',
      '- **Depends on:** Set up database',
      '',
      '## [ ] Add logging',
      '- **Priority:** low',
      '- **Type:** code',
      '- **Context:** Structured logging middleware',
    ].join('\n');

    const tasks = parseTasksFileSimple(tasksContent);
    expect(tasks).toHaveLength(3);

    const batches = buildExecutionPlan(tasks);
    expect(batches.length).toBeGreaterThanOrEqual(1);

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      return { success: true, output: `Completed: ${task.title}`, durationMs: 5 };
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);

    // Verify that the dependency ordering was respected: "Set up database" must
    // have been called before "Write API endpoints"
    const calledTitles = runner.mock.calls.map((call) => (call[0] as Task).title);
    const dbIndex = calledTitles.indexOf('Set up database');
    const apiIndex = calledTitles.indexOf('Write API endpoints');
    expect(dbIndex).toBeLessThan(apiIndex);
  });

  it('writer integration: executor results enable updateTaskStatus calls', async () => {
    const tasksContent = [
      '## [ ] Build feature X',
      '- **Priority:** high',
      '- **Type:** code',
      '- **Context:** Implement feature X',
      '',
      '## [ ] Fix bug Y',
      '- **Priority:** medium',
      '- **Type:** code',
      '- **Context:** Fix the Y bug',
    ].join('\n');

    const tasks = parseTasksFileSimple(tasksContent);
    const batches = buildExecutionPlan(tasks);

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Fix bug Y') {
        return failResult('bug fix failed');
      }
      return successResult('done');
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    // Verify the executor produced actionable results for the writer
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe('Build feature X');
    expect(result.completed[0].status).toBe('completed');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].title).toBe('Fix bug Y');
    expect(result.failed[0].status).toBe('failed');

    // Mock updateTaskStatus to verify the flow works end-to-end
    // (without actually writing to disk)
    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    for (const task of result.completed) {
      await mockUpdate('TASKS.md', task.title, task.status);
    }
    for (const task of result.failed) {
      await mockUpdate('TASKS.md', task.title, task.status);
    }

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith('TASKS.md', 'Build feature X', 'completed');
    expect(mockUpdate).toHaveBeenCalledWith('TASKS.md', 'Fix bug Y', 'failed');
  });

  it('config integration: executor respects concurrency and timeout from config', async () => {
    const config = resolveConfig({ concurrency: 2, timeout: 50 }, {});

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(50);

    const tasks = [
      makeTask({ title: 'T1' }),
      makeTask({ title: 'T2' }),
      makeTask({ title: 'T3' }),
      makeTask({ title: 'T4' }),
    ];
    const batches: ExecutionBatch[] = [{ tasks, parallel: true }];

    const executing = new Set<string>();
    let maxConcurrent = 0;

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      executing.add(task.title);
      maxConcurrent = Math.max(maxConcurrent, executing.size);
      await new Promise(resolve => setTimeout(resolve, 10));
      executing.delete(task.title);
      return successResult(task.title);
    });

    const executor = new TaskExecutor(config, runner);
    const result = await executor.execute(batches);

    // Concurrency should be capped at 2
    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(result.completed).toHaveLength(4);

    // Now verify timeout is also respected via the config
    const slowRunner = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return successResult();
    });

    const slowBatches: ExecutionBatch[] = [
      { tasks: [makeTask({ title: 'Slow' })], parallel: false },
    ];

    const timeoutExecutor = new TaskExecutor(config, slowRunner);
    const timeoutResult = await timeoutExecutor.execute(slowBatches);

    expect(timeoutResult.failed).toHaveLength(1);
    expect(timeoutResult.failed[0].title).toBe('Slow');
  });

  it('report generation: execute tasks then generate markdown report', async () => {
    const tasksContent = [
      '## [ ] Migrate database',
      '- **Priority:** high',
      '- **Type:** code',
      '- **Context:** Migrate to v2 schema',
      '',
      '## [ ] Update docs',
      '- **Priority:** low',
      '- **Type:** docs',
      '- **Context:** Update API documentation',
      '- **Depends on:** Migrate database',
    ].join('\n');

    const tasks = parseTasksFileSimple(tasksContent);
    const batches = buildExecutionPlan(tasks);

    const runner = vi.fn().mockResolvedValue(successResult('done'));

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    const report = generateReport(result, ['abc1234 - migrated db', 'def5678 - updated docs']);

    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('## Completed');
    expect(report).toContain('Migrate database');
    expect(report).toContain('Update docs');
    expect(report).toContain('2/2 completed');
    expect(report).toContain('## Commits');
    expect(report).toContain('abc1234 - migrated db');
    expect(report).toContain('def5678 - updated docs');
    // Should NOT contain Failed or Skipped sections
    expect(report).not.toContain('## Failed');
    expect(report).not.toContain('## Skipped');
  });

  it('circular dependency handling: executor processes circular batch', async () => {
    // Create tasks with circular deps: A -> B -> C -> A
    const tasks = [
      makeTask({ title: 'Alpha', dependsOn: ['Charlie'] }),
      makeTask({ title: 'Bravo', dependsOn: ['Alpha'] }),
      makeTask({ title: 'Charlie', dependsOn: ['Bravo'] }),
    ];

    const batches = buildExecutionPlan(tasks);

    // The scheduler should detect the circular dependency and create a batch
    // with the circular flag set
    const circularBatch = batches.find(b => b.circular === true);
    expect(circularBatch).toBeDefined();
    expect(circularBatch!.tasks).toHaveLength(3);

    // Now execute the circular batch -- the executor will still attempt to run
    // the tasks (it treats circular batches as sequential)
    const runner = vi.fn().mockImplementation(async (task: Task) => {
      return successResult(`ran ${task.title}`);
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    // The executor runs them regardless of the circular flag; it just processes
    // tasks as given. All three should complete since the runner succeeds.
    expect(result.completed).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it('JSON report integration: execute tasks then generate valid JSON report', async () => {
    const tasksContent = [
      '## [ ] Task one',
      '- **Priority:** high',
      '- **Type:** code',
      '- **Context:** First task',
      '',
      '## [ ] Task two',
      '- **Priority:** medium',
      '- **Type:** test',
      '- **Context:** Second task',
      '- **Depends on:** Task one',
      '',
      '## [ ] Task three',
      '- **Priority:** low',
      '- **Type:** docs',
      '- **Context:** Third task',
    ].join('\n');

    const tasks = parseTasksFileSimple(tasksContent);
    const batches = buildExecutionPlan(tasks);

    const runner = vi.fn().mockImplementation(async (task: Task) => {
      if (task.title === 'Task two') {
        return failResult('test failures');
      }
      return successResult(`done: ${task.title}`);
    });

    const executor = new TaskExecutor(makeConfig(), runner);
    const result = await executor.execute(batches);

    const commits = ['aaa1111 - initial commit'];
    const jsonString = generateJsonReport(result, commits);

    // Verify valid JSON
    const parsed = JSON.parse(jsonString);

    // Verify structure
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('tasks');
    expect(parsed).toHaveProperty('commits');
    expect(parsed).toHaveProperty('generatedAt');

    // Verify summary values
    expect(parsed.summary.completed).toBe(result.completed.length);
    expect(parsed.summary.failed).toBe(result.failed.length);
    expect(parsed.summary.skipped).toBe(result.skipped.length);
    expect(parsed.summary.totalTasks).toBe(
      result.completed.length + result.failed.length + result.skipped.length,
    );

    // Verify tasks section reflects the actual execution
    expect(parsed.tasks.completed.length).toBe(result.completed.length);
    expect(parsed.tasks.failed.length).toBe(result.failed.length);
    expect(parsed.tasks.skipped.length).toBe(result.skipped.length);

    // "Task one" and "Task three" should be completed, "Task two" failed
    const completedTitles = parsed.tasks.completed.map((t: Task) => t.title).sort();
    expect(completedTitles).toEqual(['Task one', 'Task three']);

    const failedTitles = parsed.tasks.failed.map((t: Task) => t.title);
    expect(failedTitles).toEqual(['Task two']);

    // Commits
    expect(parsed.commits).toEqual(['aaa1111 - initial commit']);

    // generatedAt should be a valid ISO date string
    expect(new Date(parsed.generatedAt).toISOString()).toBe(parsed.generatedAt);
  });
});
