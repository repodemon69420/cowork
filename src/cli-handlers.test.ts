import { describe, it, expect } from 'vitest';
import { runHandler, statusHandler, reportHandler } from './cli-handlers.js';

const sampleTasks = `## [ ] Build the login page
**Priority:** high
**Type:** code
**Context:** Create a responsive login form.

## [ ] Write API docs
**Priority:** medium
**Type:** docs
**Context:** Document the REST endpoints.
**Depends on:** Build the login page

## [x] Setup CI pipeline
**Priority:** medium
**Type:** code
**Context:** Configure GitHub Actions.
`;

describe('runHandler', () => {
  it('returns message for empty content', () => {
    const result = runHandler('');
    expect(result).toBe('No tasks found in file.');
  });

  it('returns message when no pending tasks', () => {
    const content = `## [x] Done task
**Priority:** low
**Type:** code
**Context:** Already completed.
`;
    const result = runHandler(content);
    expect(result).toBe('No pending tasks to execute.');
  });

  it('formats execution plan with batches', () => {
    const result = runHandler(sampleTasks);
    expect(result).toContain('Execution Plan');
    expect(result).toContain('Batch 1');
    expect(result).toContain('Build the login page');
    expect(result).toContain('Batch 2');
    expect(result).toContain('Write API docs');
  });

  it('shows parallel mode when multiple tasks in a batch', () => {
    const content = `## [ ] Task A
**Priority:** high
**Type:** code
**Context:** First task.

## [ ] Task B
**Priority:** medium
**Type:** docs
**Context:** Second task.
`;
    const result = runHandler(content);
    expect(result).toContain('parallel');
  });

  it('shows sequential mode for single-task batches', () => {
    const content = `## [ ] Only task
**Priority:** high
**Type:** code
**Context:** Solo task.
`;
    const result = runHandler(content);
    expect(result).toContain('sequential');
  });

  it('shows total task and batch count', () => {
    const result = runHandler(sampleTasks);
    expect(result).toContain('2 task(s)');
    expect(result).toContain('2 batch(es)');
  });

  it('shows priority and type in task lines', () => {
    const result = runHandler(sampleTasks);
    expect(result).toContain('[high] Build the login page (code)');
    expect(result).toContain('[medium] Write API docs (docs)');
  });

  it('marks circular dependency batches', () => {
    const content = `## [ ] A
**Priority:** high
**Type:** code
**Context:** Depends on B.
**Depends on:** B

## [ ] B
**Priority:** high
**Type:** code
**Context:** Depends on A.
**Depends on:** A
`;
    const result = runHandler(content);
    expect(result).toContain('CIRCULAR');
  });
});

describe('statusHandler', () => {
  it('returns message for empty content', () => {
    const result = statusHandler('');
    expect(result).toBe('No tasks found in file.');
  });

  it('formats a status table with headers', () => {
    const result = statusHandler(sampleTasks);
    expect(result).toContain('Title');
    expect(result).toContain('Status');
    expect(result).toContain('Priority');
    expect(result).toContain('Dependencies');
  });

  it('includes separator line', () => {
    const result = statusHandler(sampleTasks);
    const lines = result.split('\n');
    expect(lines[1]).toMatch(/^-+ \| -+ \| -+ \| -+$/);
  });

  it('shows all tasks in the table', () => {
    const result = statusHandler(sampleTasks);
    expect(result).toContain('Build the login page');
    expect(result).toContain('Write API docs');
    expect(result).toContain('Setup CI pipeline');
  });

  it('shows correct statuses', () => {
    const result = statusHandler(sampleTasks);
    expect(result).toContain('pending');
    expect(result).toContain('completed');
  });

  it('shows dependencies', () => {
    const result = statusHandler(sampleTasks);
    expect(result).toContain('Build the login page');
  });

  it('shows dash for no dependencies', () => {
    const result = statusHandler(sampleTasks);
    const lines = result.split('\n');
    const loginLine = lines.find(l => l.includes('Build the login page'));
    expect(loginLine).toContain('-');
  });

  it('produces correct number of rows', () => {
    const result = statusHandler(sampleTasks);
    const lines = result.split('\n');
    // 1 header + 1 separator + 3 data rows
    expect(lines).toHaveLength(5);
  });
});

describe('reportHandler', () => {
  const validJson = JSON.stringify({
    result: {
      completed: [
        { title: 'Task A', priority: 'high', type: 'code', context: 'ctx', status: 'completed' },
      ],
      failed: [],
      skipped: [
        { title: 'Task B', priority: 'low', type: 'docs', context: 'ctx', status: 'skipped' },
      ],
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T02:30:00Z',
    },
    commits: ['abc1234 Initial commit', 'def5678 Fix bug'],
  });

  it('throws on invalid JSON', () => {
    expect(() => reportHandler('not json')).toThrow('Invalid JSON input');
  });

  it('throws on non-object JSON', () => {
    expect(() => reportHandler('"string"')).toThrow('Invalid JSON input: expected an object');
  });

  it('throws on invalid dates', () => {
    const badJson = JSON.stringify({
      completed: [],
      failed: [],
      skipped: [],
      startTime: 'not-a-date',
      endTime: '2025-01-01T00:00:00Z',
    });
    expect(() => reportHandler(badJson)).toThrow('startTime is not a valid date');
  });

  it('generates a report with completed tasks', () => {
    const result = reportHandler(validJson);
    expect(result).toContain('Overnight Session Report');
    expect(result).toContain('Task A');
  });

  it('includes duration', () => {
    const result = reportHandler(validJson);
    expect(result).toContain('2h 30m');
  });

  it('includes completion count', () => {
    const result = reportHandler(validJson);
    expect(result).toContain('1/2 completed');
  });

  it('includes commits', () => {
    const result = reportHandler(validJson);
    expect(result).toContain('abc1234 Initial commit');
    expect(result).toContain('def5678 Fix bug');
  });

  it('includes skipped section', () => {
    const result = reportHandler(validJson);
    expect(result).toContain('Skipped');
    expect(result).toContain('Task B');
  });

  it('handles result at top level (no wrapper)', () => {
    const topLevelJson = JSON.stringify({
      completed: [
        { title: 'T1', priority: 'high', type: 'code', context: '', status: 'completed' },
      ],
      failed: [],
      skipped: [],
      startTime: '2025-06-01T10:00:00Z',
      endTime: '2025-06-01T10:45:00Z',
    });
    const result = reportHandler(topLevelJson);
    expect(result).toContain('T1');
    expect(result).toContain('45m');
  });

  it('handles missing commits array gracefully', () => {
    const noCommits = JSON.stringify({
      completed: [],
      failed: [],
      skipped: [],
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T01:00:00Z',
    });
    const result = reportHandler(noCommits);
    expect(result).toContain('Overnight Session Report');
    expect(result).not.toContain('Commits');
  });
});
