import { describe, it, expect } from 'vitest';
import { serializeTasks, updateTaskStatus, appendTasks } from './writer.js';
import { parseTasksFile } from './parser.js';
import { Task } from './types.js';

const HEADER = '# Status: ON\n\n# Nightly Task Queue\n\n> Add tasks below...\n\n---\n';

describe('serializeTasks', () => {
  it('empty array produces just the header', () => {
    expect(serializeTasks([])).toBe(HEADER);
  });

  it('single pending task serialized correctly', () => {
    const tasks: Task[] = [
      {
        title: 'Build login page',
        priority: 'high',
        type: 'code',
        context: 'Create a responsive login form.',
        status: 'pending',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toBe(
      HEADER +
        '\n## [ ] Build login page\n' +
        '**Priority:** high\n' +
        '**Type:** code\n' +
        '**Context:** Create a responsive login form.\n' +
        '\n---\n',
    );
  });

  it('completed task uses [x] marker', () => {
    const tasks: Task[] = [
      {
        title: 'Setup CI',
        priority: 'medium',
        type: 'code',
        context: 'Configure GitHub Actions.',
        status: 'completed',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('## [x] Setup CI');
  });

  it('failed task uses [!] marker', () => {
    const tasks: Task[] = [
      {
        title: 'Deploy staging',
        priority: 'high',
        type: 'code',
        context: 'Deploy to staging.',
        status: 'failed',
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('## [!] Deploy staging');
  });

  it('task with dependsOn includes Depends on field', () => {
    const tasks: Task[] = [
      {
        title: 'Run tests',
        priority: 'medium',
        type: 'test',
        context: 'Run full suite.',
        status: 'pending',
        dependsOn: ['Build the app', 'Setup database'],
      },
    ];
    const result = serializeTasks(tasks);
    expect(result).toContain('**Depends on:** Build the app, Setup database');
  });

  it('multiple tasks separated by ---', () => {
    const tasks: Task[] = [
      {
        title: 'Task one',
        priority: 'high',
        type: 'code',
        context: 'First task.',
        status: 'pending',
      },
      {
        title: 'Task two',
        priority: 'low',
        type: 'docs',
        context: 'Second task.',
        status: 'completed',
      },
    ];
    const result = serializeTasks(tasks);
    // Each task block ends with \n---\n, so there should be separator between them
    const taskBlocks = result.split('---').filter(b => b.includes('##'));
    expect(taskBlocks).toHaveLength(2);
    expect(result).toContain('## [ ] Task one');
    expect(result).toContain('## [x] Task two');
  });
});

describe('updateTaskStatus', () => {
  it('marks pending task as completed', () => {
    const content = '## [ ] Build login\n**Priority:** high\n**Type:** code\n**Context:** Do it.\n';
    const result = updateTaskStatus(content, 'Build login', 'completed');
    expect(result).toContain('## [x] Build login');
    expect(result).not.toContain('## [ ] Build login');
  });

  it('marks completed task as failed', () => {
    const content = '## [x] Deploy app\n**Priority:** high\n**Type:** code\n**Context:** Deploy.\n';
    const result = updateTaskStatus(content, 'Deploy app', 'failed');
    expect(result).toContain('## [!] Deploy app');
    expect(result).not.toContain('## [x] Deploy app');
  });

  it('returns unchanged content when task not found', () => {
    const content = '## [ ] Existing task\n**Priority:** high\n**Type:** code\n**Context:** Here.\n';
    const result = updateTaskStatus(content, 'Nonexistent task', 'completed');
    expect(result).toBe(content);
  });

  it('handles task title with special regex characters', () => {
    const content = '## [ ] Fix bug (issue #42)\n**Priority:** high\n**Type:** code\n**Context:** Fix it.\n';
    const result = updateTaskStatus(content, 'Fix bug (issue #42)', 'completed');
    expect(result).toContain('## [x] Fix bug (issue #42)');
    expect(result).not.toContain('## [ ] Fix bug (issue #42)');
  });
});

describe('appendTasks', () => {
  it('adds tasks to content without HTML comments', () => {
    const content = HEADER + '\n## [ ] Existing task\n**Priority:** high\n**Type:** code\n**Context:** Already here.\n\n---\n';
    const newTasks: Task[] = [
      {
        title: 'New task',
        priority: 'medium',
        type: 'test',
        context: 'Freshly added.',
        status: 'pending',
      },
    ];
    const result = appendTasks(content, newTasks);
    expect(result).toContain('## [ ] Existing task');
    expect(result).toContain('## [ ] New task');
    expect(result).toContain('**Context:** Freshly added.');
  });

  it('inserts tasks before HTML comments', () => {
    const content =
      HEADER +
      '\n## [ ] Existing task\n**Priority:** high\n**Type:** code\n**Context:** Already here.\n\n---\n' +
      '\n<!-- INSTRUCTIONS:\n  Template here.\n-->\n';
    const newTasks: Task[] = [
      {
        title: 'New task',
        priority: 'low',
        type: 'docs',
        context: 'Added before comment.',
        status: 'pending',
      },
    ];
    const result = appendTasks(content, newTasks);
    const newTaskPos = result.indexOf('## [ ] New task');
    const commentPos = result.indexOf('<!-- INSTRUCTIONS:');
    expect(newTaskPos).toBeGreaterThan(-1);
    expect(commentPos).toBeGreaterThan(-1);
    expect(newTaskPos).toBeLessThan(commentPos);
  });
});

describe('round-trip', () => {
  it('parseTasksFile(serializeTasks(tasks)) equals original tasks', () => {
    const tasks: Task[] = [
      {
        title: 'Scaffold project',
        priority: 'high',
        type: 'code',
        context: 'Create initial layout.',
        status: 'pending',
      },
      {
        title: 'Write tests',
        priority: 'medium',
        type: 'test',
        context: 'Add unit tests.',
        status: 'completed',
        dependsOn: ['Scaffold project'],
      },
      {
        title: 'Deploy',
        priority: 'low',
        type: 'docs',
        context: 'Write deploy docs.',
        status: 'failed',
      },
    ];
    const serialized = serializeTasks(tasks);
    const parsed = parseTasksFile(serialized);
    expect(parsed).toEqual(tasks);
  });
});

describe('unicode support', () => {
  it('handles unicode in title and context', () => {
    const tasks: Task[] = [
      {
        title: 'Configurar autenticación 🔐',
        priority: 'high',
        type: 'code',
        context: 'Implementar OAuth con proveedores externos — incluir soporte para 日本語.',
        status: 'pending',
      },
    ];
    const serialized = serializeTasks(tasks);
    expect(serialized).toContain('## [ ] Configurar autenticación 🔐');
    expect(serialized).toContain('Implementar OAuth con proveedores externos — incluir soporte para 日本語.');

    const parsed = parseTasksFile(serialized);
    expect(parsed[0].title).toBe('Configurar autenticación 🔐');
    expect(parsed[0].context).toBe('Implementar OAuth con proveedores externos — incluir soporte para 日本語.');
  });
});
