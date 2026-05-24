import { describe, it, expect } from 'vitest';
import { createSession, transitionTo, SessionState } from './session.js';
import type { CoworkConfig } from './config.js';

const stubConfig: CoworkConfig = {
  repo: { owner: 'o', name: 'n', url: 'u', localPath: '/tmp' },
  orchestrator: { triggerId: 't', taskFile: 'f', outputFile: 'o' },
  phone: { toggleIssueNumber: 1, toggleIssueTitle: 'title' },
};

describe('createSession', () => {
  it('creates a session with defaults', () => {
    const ctx = createSession(stubConfig);
    expect(ctx.state).toBe('idle');
    expect(ctx.iteration).toBe(1);
    expect(ctx.branch).toBe('claude/iter-1');
    expect(ctx.plan).toBeNull();
    expect(ctx.results).toEqual([]);
    expect(ctx.errors).toEqual([]);
    expect(ctx.startTime).toBeInstanceOf(Date);
    expect(ctx.config).toBe(stubConfig);
  });

  it('creates a session with custom iteration', () => {
    const ctx = createSession(stubConfig, 5);
    expect(ctx.iteration).toBe(5);
    expect(ctx.branch).toBe('claude/iter-5');
  });
});

describe('transitionTo', () => {
  const paths: [SessionState, SessionState][] = [
    ['idle', 'syncing'],
    ['syncing', 'ideating'],
    ['syncing', 'planning'],
    ['syncing', 'stopped'],
    ['ideating', 'planning'],
    ['planning', 'building'],
    ['building', 'testing'],
    ['testing', 'reviewing'],
    ['testing', 'building'],
    ['reviewing', 'merging'],
    ['reviewing', 'building'],
    ['merging', 'reporting'],
    ['reporting', 'idle'],
    ['reporting', 'stopped'],
  ];

  it.each(paths)('%s → %s is valid', (from, to) => {
    const ctx = { ...createSession(stubConfig), state: from };
    const next = transitionTo(ctx, to);
    expect(next.state).toBe(to);
  });

  it('throws on invalid transition', () => {
    const ctx = createSession(stubConfig);
    expect(() => transitionTo(ctx, 'building')).toThrowError(
      'Invalid transition: idle → building',
    );
  });

  it('allows transition to stopped from any state', () => {
    const states: SessionState[] = [
      'idle', 'syncing', 'ideating', 'planning',
      'building', 'testing', 'reviewing', 'merging', 'reporting',
    ];
    for (const s of states) {
      const ctx = { ...createSession(stubConfig), state: s };
      expect(transitionTo(ctx, 'stopped').state).toBe('stopped');
    }
  });

  it('preserves immutability — original context unchanged', () => {
    const ctx = createSession(stubConfig);
    const next = transitionTo(ctx, 'syncing');
    expect(ctx.state).toBe('idle');
    expect(next.state).toBe('syncing');
    expect(next).not.toBe(ctx);
  });
});
