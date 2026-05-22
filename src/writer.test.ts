import { describe, it, expect } from 'vitest';
import { serializeTask, serializeTasks, updateTaskStatus } from './writer.js';
import { parseTasksFile } from './parser.js';
import { Task } from './types.js';

const DEFAULT_HEADER = [
  '# Status: ON',
  '',
  '# Nightly Task Queue',
  '',
  '> Add tasks below before sleeping. The orchestrator processes these top-to-bottom,',
  '> running independent tasks in parallel. Mark completed tasks with [x].',
  '',
  '---',
].join('\n');

describe('serializeTask', () => {
  it('serializes a pending task', () => {
    const task: Task = {
      title: 'Build the login page',
      priority: 'high',
      type: 'code',
      context: 'Create a responsive login form.',
      status: 'pending',
    };
    const result = serializeTask(task);
    expect(result).toBe(
      '## [ ] Build the login page\n' +
      '**Priority:** high\n' +
      '**Type:** code\n' +
      '**Context:** Create a responsive login form.'
    );
  });

  it('serializes a completed task', () => {
    const task: Task = {
      title: 'Setup CI pipeline',
      priority: 'medium',
      type: 'code',
      context: 'Configure GitHub Actions.',
      status: 'completed',
    };
    const result = serializeTask(task);
    expect(result).toContain('## [x] Setup CI pipeline');
  });

  it('serializes a failed task', () => {
    const task: Task = {
      title: 'Deploy to staging',
      priority: 'high',
      type: 'code',
      context: 'Deploy current build.',
      status: 'failed',
    };
    const result = serializeTask(task);
    expect(result).toContain('## [!] Deploy to staging');
  });

  it('serializes a skipped task', () => {
    const task: Task = {
      title: 'Optional cleanup',
      priority: 'low',
      type: 'refactor',
      context: 'Clean up old files.',
      status: 'skipped',
    };
    const result = serializeTask(task);
    expect(result).toContain('## [-] Optional cleanup');
  });

  it('serializes a task with dependsOn', () => {
    const task: Task = {
      title: 'Run integration tests',
      priority: 'medium',
      type: 'test',
      context: 'Run full test suite.',
      status: 'pending',
      dependsOn: ['Build the app', 'Setup database'],
    };
    const result = serializeTask(task);
    expect(result).toBe(
      '## [ ] Run integration tests\n' +
      '**Priority:** medium\n' +
      '**Type:** test\n' +
      '**Context:** Run full test suite.\n' +
      '**Depends on:** Build the app, Setup database'
    );
  });

  it('serializes a task with single dependency', () => {
    const task: Task = {
      title: 'Deploy',
      priority: 'high',
      type: 'code',
      context: 'Deploy to production.',
      status: 'pending',
      dependsOn: ['Run tests'],
    };
    const result = serializeTask(task);
    expect(result).toContain('**Depends on:** Run tests');
  });

  it('serializes a task with empty context', () => {
    const task: Task = {
      title: 'Mystery task',
      priority: 'low',
      type: 'research',
      context: '',
      status: 'pending',
    };
    const result = serializeTask(task);
    expect(result).toContain('**Context:** ');
    expect(result).toBe(
      '## [ ] Mystery task\n' +
      '**Priority:** low\n' +
      '**Type:** research\n' +
      '**Context:** '
    );
  });

  it('serializes a task with empty dependsOn array (omits field)', () => {
    const task: Task = {
      title: 'Solo task',
      priority: 'high',
      type: 'code',
      context: 'No dependencies.',
      status: 'pending',
      dependsOn: [],
    };
    const result = serializeTask(task);
    expect(result).not.toContain('Depends on');
  });
});

describe('serializeTasks', () => {
  it('produces just the header for an empty array', () => {
    const result = serializeTasks([]);
    expect(result).toBe(DEFAULT_HEADER + '\n');
  });

  it('serializes multiple tasks with separators', () => {
    const tasks: Task[] = [
      {
        title: 'First task',
        priority: 'high',
        type: 'code',
        context: 'Do first.',
        status: 'pending',
      },
      {
        title: 'Second task',
        priority: 'medium',
        type: 'test',
        context: 'Do second.',
        status: 'completed',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('## [ ] First task');
    expect(result).toContain('## [x] Second task');

    const taskBlocks = result.split('\n\n---\n\n');
    expect(taskBlocks.length).toBe(3);
  });

  it('uses a custom header when provided', () => {
    const customHeader = '# My Custom Header\n\n---';
    const tasks: Task[] = [
      {
        title: 'A task',
        priority: 'low',
        type: 'docs',
        context: 'Write docs.',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks, customHeader);
    expect(result.startsWith('# My Custom Header')).toBe(true);
    expect(result).not.toContain('Nightly Task Queue');
  });

  it('ends with a newline', () => {
    const tasks: Task[] = [
      {
        title: 'A task',
        priority: 'high',
        type: 'code',
        context: 'Some work.',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toMatch(/\n$/);
  });

  it('round-trip: serialize then parse produces equivalent tasks', () => {
    const originalTasks: Task[] = [
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
        context: 'Add tests for utilities.',
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

    const serialized = serializeTasks(originalTasks);
    const parsed = parseTasksFile(serialized);

    expect(parsed).toHaveLength(originalTasks.length);
    for (let i = 0; i < originalTasks.length; i++) {
      expect(parsed[i].title).toBe(originalTasks[i].title);
      expect(parsed[i].priority).toBe(originalTasks[i].priority);
      expect(parsed[i].type).toBe(originalTasks[i].type);
      expect(parsed[i].context).toBe(originalTasks[i].context);
      expect(parsed[i].status).toBe(originalTasks[i].status);
      expect(parsed[i].dependsOn).toEqual(originalTasks[i].dependsOn);
    }
  });

  it('skipped status serializes with [-] marker', () => {
    const tasks: Task[] = [
      {
        title: 'Skipped task',
        priority: 'low',
        type: 'docs',
        context: 'Was skipped.',
        status: 'skipped',
      },
    ];
    const serialized = serializeTasks(tasks);
    expect(serialized).toContain('## [-] Skipped task');
  });
});

describe('updateTaskStatus', () => {
  const sampleContent = [
    '# Status: ON',
    '',
    '# Nightly Task Queue',
    '',
    '---',
    '',
    '## [ ] Build the login page',
    '**Priority:** high',
    '**Type:** code',
    '**Context:** Create a login form.',
    '',
    '---',
    '',
    '## [ ] Write unit tests',
    '**Priority:** medium',
    '**Type:** test',
    '**Context:** Add tests.',
    '**Depends on:** Build the login page',
    '',
    '---',
  ].join('\n');

  it('changes pending to completed', () => {
    const result = updateTaskStatus(sampleContent, 'Build the login page', 'completed');
    expect(result).toContain('## [x] Build the login page');
    expect(result).not.toContain('## [ ] Build the login page');
  });

  it('changes pending to failed', () => {
    const result = updateTaskStatus(sampleContent, 'Build the login page', 'failed');
    expect(result).toContain('## [!] Build the login page');
    expect(result).not.toContain('## [ ] Build the login page');
  });

  it('changes pending to skipped', () => {
    const result = updateTaskStatus(sampleContent, 'Build the login page', 'skipped');
    expect(result).toContain('## [-] Build the login page');
  });

  it('throws error when task title is not found', () => {
    expect(() => {
      updateTaskStatus(sampleContent, 'Nonexistent task', 'completed');
    }).toThrow('Task not found: Nonexistent task');
  });

  it('does not modify other tasks', () => {
    const result = updateTaskStatus(sampleContent, 'Build the login page', 'completed');
    expect(result).toContain('## [ ] Write unit tests');
  });

  it('handles task titles with special characters', () => {
    const content = [
      '## [ ] Fix bug (critical!) [v2.0]',
      '**Priority:** high',
      '**Type:** code',
      '**Context:** Fix the critical bug.',
    ].join('\n');

    const result = updateTaskStatus(content, 'Fix bug (critical!) [v2.0]', 'completed');
    expect(result).toContain('## [x] Fix bug (critical!) [v2.0]');
    expect(result).not.toContain('## [ ] Fix bug (critical!) [v2.0]');
  });

  it('can change completed back to pending', () => {
    const content = [
      '## [x] Already done',
      '**Priority:** medium',
      '**Type:** code',
      '**Context:** Was completed.',
    ].join('\n');

    const result = updateTaskStatus(content, 'Already done', 'pending');
    expect(result).toContain('## [ ] Already done');
    expect(result).not.toContain('## [x] Already done');
  });

  it('can change failed to completed', () => {
    const content = [
      '## [!] Previously failed',
      '**Priority:** high',
      '**Type:** code',
      '**Context:** Failed before.',
    ].join('\n');

    const result = updateTaskStatus(content, 'Previously failed', 'completed');
    expect(result).toContain('## [x] Previously failed');
  });
});
