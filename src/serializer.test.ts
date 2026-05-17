import { describe, it, expect } from 'vitest';
import { serializeTasks, updateTaskStatus } from './serializer.js';
import { parseTasksFile } from './parser.js';
import { Task } from './types.js';

describe('serializeTasks', () => {
  it('returns empty string for empty array', () => {
    expect(serializeTasks([])).toBe('');
  });

  it('serializes a single pending task', () => {
    const tasks: Task[] = [
      {
        title: 'Build the login page',
        priority: 'high',
        type: 'code',
        context: 'Create a responsive login form with email and password fields.',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toBe(
      `## [ ] Build the login page\n**Priority:** high\n**Type:** code\n**Context:** Create a responsive login form with email and password fields.\n\n---\n`,
    );
  });

  it('serializes a completed task with [x]', () => {
    const tasks: Task[] = [
      {
        title: 'Setup CI pipeline',
        priority: 'medium',
        type: 'code',
        context: 'Configure GitHub Actions for automated testing.',
        status: 'completed',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('## [x] Setup CI pipeline');
  });

  it('serializes a failed task with [!]', () => {
    const tasks: Task[] = [
      {
        title: 'Deploy to staging',
        priority: 'high',
        type: 'code',
        context: 'Deploy current build to staging environment.',
        status: 'failed',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('## [!] Deploy to staging');
  });

  it('serializes a skipped task with [ ]', () => {
    const tasks: Task[] = [
      {
        title: 'Optional cleanup',
        priority: 'low',
        type: 'refactor',
        context: 'Clean up unused imports.',
        status: 'skipped',
      },
    ];
    const result = serializeTasks(tasks);
    // skipped tasks use [ ] since there is no dedicated marker
    expect(result).toContain('## [ ] Optional cleanup');
  });

  it('serializes task with dependsOn field', () => {
    const tasks: Task[] = [
      {
        title: 'Run integration tests',
        priority: 'medium',
        type: 'test',
        context: 'Run full integration test suite.',
        status: 'pending',
        dependsOn: ['Build the app', 'Setup database'],
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('**Depends on:** Build the app, Setup database');
  });

  it('serializes task with single dependency', () => {
    const tasks: Task[] = [
      {
        title: 'Deploy',
        priority: 'high',
        type: 'code',
        context: 'Deploy to production.',
        status: 'pending',
        dependsOn: ['Run tests'],
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('**Depends on:** Run tests');
  });

  it('omits Depends on line when dependsOn is undefined', () => {
    const tasks: Task[] = [
      {
        title: 'Independent task',
        priority: 'high',
        type: 'code',
        context: 'Standalone work.',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).not.toContain('Depends on');
  });

  it('omits Depends on line when dependsOn is empty array', () => {
    const tasks: Task[] = [
      {
        title: 'Independent task',
        priority: 'high',
        type: 'code',
        context: 'Standalone work.',
        status: 'pending',
        dependsOn: [],
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).not.toContain('Depends on');
  });

  it('serializes multiple tasks separated by ---', () => {
    const tasks: Task[] = [
      {
        title: 'First task',
        priority: 'high',
        type: 'code',
        context: 'Do the first thing.',
        status: 'pending',
      },
      {
        title: 'Second task',
        priority: 'medium',
        type: 'test',
        context: 'Do the second thing.',
        status: 'completed',
      },
      {
        title: 'Third task',
        priority: 'low',
        type: 'docs',
        context: 'Do the third thing.',
        status: 'failed',
      },
    ];
    const result = serializeTasks(tasks);

    // Check all tasks present
    expect(result).toContain('## [ ] First task');
    expect(result).toContain('## [x] Second task');
    expect(result).toContain('## [!] Third task');

    // Check separators between tasks
    const separatorCount = (result.match(/\n---\n/g) || []).length;
    expect(separatorCount).toBe(3);
  });

  it('handles task with empty context', () => {
    const tasks: Task[] = [
      {
        title: 'No context task',
        priority: 'high',
        type: 'code',
        context: '',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('**Context:**');
  });

  it('does not mutate the input array', () => {
    const tasks: Task[] = [
      {
        title: 'Immutability check',
        priority: 'high',
        type: 'code',
        context: 'Check immutability.',
        status: 'pending',
      },
    ];
    const original = JSON.parse(JSON.stringify(tasks));
    serializeTasks(tasks);
    expect(tasks).toEqual(original);
  });

  it('round-trips through parser: serialize then parse yields same tasks', () => {
    const tasks: Task[] = [
      {
        title: 'Scaffold the project structure',
        priority: 'high',
        type: 'code',
        context: 'Create the initial folder layout.',
        status: 'pending',
      },
      {
        title: 'Write unit tests',
        priority: 'medium',
        type: 'test',
        context: 'Add tests for utility functions.',
        status: 'completed',
        dependsOn: ['Scaffold the project structure'],
      },
      {
        title: 'Deploy to staging',
        priority: 'high',
        type: 'code',
        context: 'Deploy current build.',
        status: 'failed',
      },
    ];

    const markdown = serializeTasks(tasks);
    const parsed = parseTasksFile(markdown);
    expect(parsed).toEqual(tasks);
  });

  it('round-trips a task without dependsOn (property absent)', () => {
    const tasks: Task[] = [
      {
        title: 'Simple task',
        priority: 'low',
        type: 'docs',
        context: 'Write docs.',
        status: 'pending',
      },
    ];

    const markdown = serializeTasks(tasks);
    const parsed = parseTasksFile(markdown);
    expect(parsed).toEqual(tasks);
    expect(parsed[0].dependsOn).toBeUndefined();
  });
});

describe('updateTaskStatus', () => {
  const sampleContent = `# Nightly Task Queue

> Instructions here.

---

## [ ] First task
**Priority:** high
**Type:** code
**Context:** Do the first thing.

---

## [ ] Second task
**Priority:** medium
**Type:** test
**Context:** Do the second thing.
**Depends on:** First task

---

## [x] Already done
**Priority:** low
**Type:** docs
**Context:** This was already completed.

---
`;

  it('marks a pending task as completed', () => {
    const result = updateTaskStatus(sampleContent, 'First task', 'completed');
    expect(result).toContain('## [x] First task');
    // Other tasks remain unchanged
    expect(result).toContain('## [ ] Second task');
    expect(result).toContain('## [x] Already done');
  });

  it('marks a pending task as failed', () => {
    const result = updateTaskStatus(sampleContent, 'Second task', 'failed');
    expect(result).toContain('## [!] Second task');
    // Other tasks remain unchanged
    expect(result).toContain('## [ ] First task');
  });

  it('changes a completed task back to pending', () => {
    const result = updateTaskStatus(sampleContent, 'Already done', 'pending');
    expect(result).toContain('## [ ] Already done');
  });

  it('returns content unchanged when title is not found', () => {
    const result = updateTaskStatus(sampleContent, 'Non-existent task', 'completed');
    expect(result).toBe(sampleContent);
  });

  it('does not mutate the original content string', () => {
    const original = sampleContent;
    updateTaskStatus(sampleContent, 'First task', 'completed');
    expect(sampleContent).toBe(original);
  });

  it('handles content with only one task', () => {
    const content = `## [ ] Only task
**Priority:** high
**Type:** code
**Context:** The only task.

---
`;
    const result = updateTaskStatus(content, 'Only task', 'completed');
    expect(result).toContain('## [x] Only task');
  });

  it('updates correct task when titles are similar', () => {
    const content = `## [ ] Add tests
**Priority:** high
**Type:** test
**Context:** Add unit tests.

---

## [ ] Add tests for parser
**Priority:** medium
**Type:** test
**Context:** Add parser tests.

---
`;
    const result = updateTaskStatus(content, 'Add tests', 'completed');
    expect(result).toContain('## [x] Add tests');
    expect(result).toContain('## [ ] Add tests for parser');
  });

  it('preserves all non-task content (headers, blockquotes, instructions)', () => {
    const result = updateTaskStatus(sampleContent, 'First task', 'completed');
    expect(result).toContain('# Nightly Task Queue');
    expect(result).toContain('> Instructions here.');
  });

  it('handles skipped status by using [ ] marker', () => {
    const result = updateTaskStatus(sampleContent, 'First task', 'skipped');
    expect(result).toContain('## [ ] First task');
  });

  it('handles failed task being updated to completed', () => {
    const content = `## [!] Broken deploy
**Priority:** high
**Type:** code
**Context:** Fix the deploy.

---
`;
    const result = updateTaskStatus(content, 'Broken deploy', 'completed');
    expect(result).toContain('## [x] Broken deploy');
    expect(result).not.toContain('## [!]');
  });
});
