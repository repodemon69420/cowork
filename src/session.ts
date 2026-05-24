import type { CoworkConfig } from './config.js';
import type { ExecutionPlan } from './types.js';

export type SessionState =
  | 'idle' | 'syncing' | 'ideating' | 'planning'
  | 'building' | 'testing' | 'reviewing' | 'merging'
  | 'reporting' | 'stopped';

export interface TaskResult {
  taskTitle: string;
  status: 'completed' | 'failed';
  duration: number;
  commitHash?: string;
  error?: string;
}

export interface SessionContext {
  state: SessionState;
  iteration: number;
  branch: string;
  config: CoworkConfig;
  plan: ExecutionPlan | null;
  results: TaskResult[];
  startTime: Date;
  errors: string[];
}

const VALID_TRANSITIONS: Record<string, SessionState[]> = {
  idle: ['syncing'],
  syncing: ['ideating', 'planning', 'stopped'],
  ideating: ['planning'],
  planning: ['building'],
  building: ['testing'],
  testing: ['reviewing', 'building'],
  reviewing: ['merging', 'building'],
  merging: ['reporting'],
  reporting: ['idle', 'stopped'],
};

export function createSession(config: CoworkConfig, iteration = 1): SessionContext {
  return {
    state: 'idle',
    iteration,
    branch: `claude/iter-${iteration}`,
    config,
    plan: null,
    results: [],
    startTime: new Date(),
    errors: [],
  };
}

export function transitionTo(ctx: SessionContext, newState: SessionState): SessionContext {
  if (newState !== 'stopped') {
    const allowed = VALID_TRANSITIONS[ctx.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(
        `Invalid transition: ${ctx.state} → ${newState}`,
      );
    }
  }
  return { ...ctx, state: newState };
}
