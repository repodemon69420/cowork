import type { SessionContext } from './session.js';
import type { Task } from './types.js';
import type { TaskResult } from './session.js';
import { transitionTo } from './session.js';
import { buildExecutionPlan } from './scheduler.js';
import { validateTasks } from './validator.js';

function assertState(ctx: SessionContext, expected: SessionContext['state']): void {
  if (ctx.state !== expected) {
    throw new Error(`Expected state '${expected}', got '${ctx.state}'`);
  }
}

export function stepSync(ctx: SessionContext): SessionContext {
  assertState(ctx, 'idle');
  const syncing = transitionTo(ctx, 'syncing');
  return transitionTo(syncing, 'planning');
}

export function stepPlan(ctx: SessionContext, tasks: Task[]): SessionContext {
  assertState(ctx, 'planning');
  const validation = validateTasks(tasks);
  const errors = validation.issues
    .filter(i => i.level === 'error')
    .map(i => i.message);
  const plan = buildExecutionPlan(tasks);
  return { ...transitionTo(ctx, 'building'), plan, errors: [...ctx.errors, ...errors] };
}

export function stepBuildComplete(ctx: SessionContext, results: TaskResult[]): SessionContext {
  assertState(ctx, 'building');
  return { ...transitionTo(ctx, 'testing'), results: [...ctx.results, ...results] };
}

export function stepTestComplete(ctx: SessionContext, passed: boolean): SessionContext {
  assertState(ctx, 'testing');
  return transitionTo(ctx, passed ? 'reviewing' : 'building');
}

export function stepReviewComplete(ctx: SessionContext, approved: boolean): SessionContext {
  assertState(ctx, 'reviewing');
  return transitionTo(ctx, approved ? 'merging' : 'building');
}

export function stepMerge(ctx: SessionContext): SessionContext {
  assertState(ctx, 'merging');
  return transitionTo(ctx, 'reporting');
}

export function stepReport(ctx: SessionContext): SessionContext {
  assertState(ctx, 'reporting');
  return { ...transitionTo(ctx, 'idle'), iteration: ctx.iteration + 1 };
}
