import { describe, it, expect } from 'vitest';
import { formatTaskSection, generateReport } from './reporter.js';
import { Task, SessionResult } from './types.js';

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

function makeResult(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    completed: [],
    failed: [],
    skipped: [],
    startTime: new Date('2026-01-15T22:00:00Z'),
    endTime: new Date('2026-01-15T23:30:00Z'),
    ...overrides,
  };
}

describe('formatTaskSection', () => {
  it('produces correct markdown for a pending task', () => {
    const task = makeTask({ title: 'Setup project', status: 'pending', type: 'code', priority: 'high' });
    const result = formatTaskSection(task);
    expect(result).toContain('## [ ] Setup project');
    expect(result).toContain('- **type**: code');
    expect(result).toContain('- **priority**: high');
  });

  it('produces correct markdown for a completed task', () => {
    const task = makeTask({ title: 'Write tests', status: 'completed', type: 'test', priority: 'medium' });
    const result = formatTaskSection(task);
    expect(result).toContain('## [x] Write tests');
    expect(result).toContain('- **type**: test');
    expect(result).toContain('- **priority**: medium');
  });

  it('produces correct markdown for a failed task', () => {
    const task = makeTask({ title: 'Deploy', status: 'failed', type: 'code', priority: 'high' });
    const result = formatTaskSection(task);
    expect(result).toContain('## [!] Deploy');
  });

  it('includes context when present', () => {
    const task = makeTask({ title: 'Task', context: 'Important detail' });
    const result = formatTaskSection(task);
    expect(result).toContain('- **context**: Important detail');
  });

  it('omits context line when context is empty', () => {
    const task = makeTask({ title: 'Task', context: '' });
    const result = formatTaskSection(task);
    expect(result).not.toContain('**context**');
  });
});

describe('generateReport', () => {
  it('generates report with all completed tasks', () => {
    const result = makeResult({
      completed: [
        makeTask({ title: 'Task A', status: 'completed' }),
        makeTask({ title: 'Task B', status: 'completed' }),
      ],
    });
    const report = generateReport(result, []);
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('**Tasks**: 2/2 completed');
    expect(report).toContain('## Completed');
    expect(report).toContain('Task A');
    expect(report).toContain('Task B');
    expect(report).not.toContain('## Failed');
    expect(report).not.toContain('## Skipped');
  });

  it('generates report with mix of completed, failed, skipped', () => {
    const result = makeResult({
      completed: [makeTask({ title: 'Done', status: 'completed' })],
      failed: [makeTask({ title: 'Broken', status: 'failed' })],
      skipped: [makeTask({ title: 'Skipped', status: 'skipped' })],
    });
    const report = generateReport(result, []);
    expect(report).toContain('**Tasks**: 1/3 completed');
    expect(report).toContain('## Completed');
    expect(report).toContain('## Failed');
    expect(report).toContain('## Skipped');
    expect(report).toContain('Done');
    expect(report).toContain('Broken');
    expect(report).toContain('Skipped');
  });

  it('handles empty session result (no tasks)', () => {
    const result = makeResult();
    const report = generateReport(result, []);
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('**Tasks**: 0/0 completed');
    expect(report).not.toContain('## Completed');
    expect(report).not.toContain('## Failed');
    expect(report).not.toContain('## Skipped');
    expect(report).not.toContain('## Commits');
  });

  it('includes commits list in report', () => {
    const result = makeResult({
      completed: [makeTask({ title: 'Task', status: 'completed' })],
    });
    const commits = ['abc1234 Initial commit', 'def5678 Add feature X'];
    const report = generateReport(result, commits);
    expect(report).toContain('## Commits');
    expect(report).toContain('- abc1234 Initial commit');
    expect(report).toContain('- def5678 Add feature X');
  });

  it('omits commits section when commits list is empty', () => {
    const result = makeResult({
      completed: [makeTask({ title: 'Task', status: 'completed' })],
    });
    const report = generateReport(result, []);
    expect(report).not.toContain('## Commits');
  });

  it('formats duration in minutes when less than an hour', () => {
    const result = makeResult({
      startTime: new Date('2026-01-15T22:00:00Z'),
      endTime: new Date('2026-01-15T22:45:00Z'),
    });
    const report = generateReport(result, []);
    expect(report).toContain('**Duration**: 45m');
  });

  it('formats duration in hours and minutes when over an hour', () => {
    const result = makeResult({
      startTime: new Date('2026-01-15T22:00:00Z'),
      endTime: new Date('2026-01-16T00:30:00Z'),
    });
    const report = generateReport(result, []);
    expect(report).toContain('**Duration**: 2h 30m');
  });

  it('formats duration as 0m for very short sessions', () => {
    const result = makeResult({
      startTime: new Date('2026-01-15T22:00:00Z'),
      endTime: new Date('2026-01-15T22:00:30Z'),
    });
    const report = generateReport(result, []);
    expect(report).toContain('**Duration**: 0m');
  });

  it('formats duration with exactly 1 hour', () => {
    const result = makeResult({
      startTime: new Date('2026-01-15T22:00:00Z'),
      endTime: new Date('2026-01-15T23:00:00Z'),
    });
    const report = generateReport(result, []);
    expect(report).toContain('**Duration**: 1h 0m');
  });
});
