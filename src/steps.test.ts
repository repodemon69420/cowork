import { describe, it, expect } from 'vitest';
import { createSession, transitionTo } from './session.js';
import type { SessionContext, TaskResult } from './session.js';
import type { CoworkConfig } from './config.js';
import type { Task } from './types.js';
import {
  stepSync, stepPlan, stepBuildComplete,
  stepTestComplete, stepReviewComplete, stepMerge, stepReport,
} from './steps.js';

const config: CoworkConfig = {
  repo: { owner: 'o', name: 'n', url: 'u', localPath: '/tmp' },
  orchestrator: { triggerId: 't', taskFile: 'f', outputFile: 'o' },
  phone: { toggleIssueNumber: 1, toggleIssueTitle: 'title' },
};

function sessionAt(state: SessionContext['state']): SessionContext {
  let ctx = createSession(config);
  if (state === 'idle') return ctx;
  ctx = transitionTo(ctx, 'syncing');
  if (state === 'syncing') return ctx;
  ctx = transitionTo(ctx, 'planning');
  if (state === 'planning') return ctx;
  ctx = transitionTo(ctx, 'building');
  if (state === 'building') return ctx;
  ctx = transitionTo(ctx, 'testing');
  if (state === 'testing') return ctx;
  ctx = transitionTo(ctx, 'reviewing');
  if (state === 'reviewing') return ctx;
  ctx = transitionTo(ctx, 'merging');
  if (state === 'merging') return ctx;
  ctx = transitionTo(ctx, 'reporting');
  if (state === 'reporting') return ctx;
  return ctx;
}

const validTask: Task = {
  title: 'Task A',
  priority: 'high',
  type: 'code',
  context: 'do something',
  status: 'pending',
};

describe('stepSync', () => {
  it('transitions from idle to planning', () => {
    const ctx = sessionAt('idle');
    const result = stepSync(ctx);
    expect(result.state).toBe('planning');
  });

  it('throws from wrong state', () => {
    const ctx = sessionAt('building');
    expect(() => stepSync(ctx)).toThrow();
  });
});

describe('stepPlan', () => {
  it('stores plan and transitions to building', () => {
    const ctx = sessionAt('planning');
    const result = stepPlan(ctx, [validTask]);
    expect(result.state).toBe('building');
    expect(result.plan).not.toBeNull();
    expect(result.plan!.batches.length).toBeGreaterThan(0);
  });

  it('adds errors for invalid tasks', () => {
    const ctx = sessionAt('planning');
    const dup: Task = { ...validTask };
    const result = stepPlan(ctx, [validTask, dup]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('stepBuildComplete', () => {
  it('appends results and transitions to testing', () => {
    const ctx = sessionAt('building');
    const taskResult: TaskResult = { taskTitle: 'Task A', status: 'completed', duration: 100 };
    const result = stepBuildComplete(ctx, [taskResult]);
    expect(result.state).toBe('testing');
    expect(result.results).toContain(taskResult);
  });
});

describe('stepTestComplete', () => {
  it('passed → reviewing', () => {
    const ctx = sessionAt('testing');
    expect(stepTestComplete(ctx, true).state).toBe('reviewing');
  });

  it('failed → building', () => {
    const ctx = sessionAt('testing');
    expect(stepTestComplete(ctx, false).state).toBe('building');
  });
});

describe('stepReviewComplete', () => {
  it('approved → merging', () => {
    const ctx = sessionAt('reviewing');
    expect(stepReviewComplete(ctx, true).state).toBe('merging');
  });

  it('rejected → building', () => {
    const ctx = sessionAt('reviewing');
    expect(stepReviewComplete(ctx, false).state).toBe('building');
  });
});

describe('stepMerge', () => {
  it('transitions to reporting', () => {
    const ctx = sessionAt('merging');
    expect(stepMerge(ctx).state).toBe('reporting');
  });
});

describe('stepReport', () => {
  it('transitions to idle with incremented iteration', () => {
    const ctx = sessionAt('reporting');
    const result = stepReport(ctx);
    expect(result.state).toBe('idle');
    expect(result.iteration).toBe(ctx.iteration + 1);
  });
});

describe('immutability', () => {
  it('original context is unchanged after stepSync', () => {
    const ctx = sessionAt('idle');
    const copy = { ...ctx };
    stepSync(ctx);
    expect(ctx).toEqual(copy);
  });

  it('original context is unchanged after stepPlan', () => {
    const ctx = sessionAt('planning');
    const copy = { ...ctx, errors: [...ctx.errors], results: [...ctx.results] };
    stepPlan(ctx, [validTask]);
    expect(ctx.state).toBe(copy.state);
    expect(ctx.plan).toBe(copy.plan);
    expect(ctx.errors).toEqual(copy.errors);
  });

  it('original context is unchanged after stepReport', () => {
    const ctx = sessionAt('reporting');
    const origIteration = ctx.iteration;
    stepReport(ctx);
    expect(ctx.iteration).toBe(origIteration);
    expect(ctx.state).toBe('reporting');
  });
});
