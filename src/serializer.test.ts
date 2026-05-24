import { describe, it, expect } from 'vitest';
import { serializeTasksFile } from './serializer.js';
import { parseTasksFile } from './parser.js';
import type { Task } from './types.js';

const HEADER = '# Status: ON\n\n# Nightly Task Queue\n\n---\n\n';

describe('serializeTasksFile', () => {
  it('serializes a single pending task', () => {
    const tasks: Task[] = [
      { title: 'Setup DB', priority: 'high', type: 'code', context: 'Create tables', status: 'pending' },
    ];
    const result = serializeTasksFile(tasks);
    expect(result).toBe(
      HEADER +
      '## [ ] Setup DB\n**Priority:** high\n**Type:** code\n**Context:** Create tables\n',
    );
  });

  it('serializes a completed task', () => {
    const tasks: Task[] = [
      { title: 'Init repo', priority: 'high', type: 'code', context: 'Done already', status: 'completed' },
    ];
    const result = serializeTasksFile(tasks);
    expect(result).toContain('## [x] Init repo');
  });

  it('serializes a failed task', () => {
    const tasks: Task[] = [
      { title: 'Broken build', priority: 'medium', type: 'test', context: 'CI failed', status: 'failed' },
    ];
    const result = serializeTasksFile(tasks);
    expect(result).toContain('## [!] Broken build');
  });

  it('serializes a task with dependsOn', () => {
    const tasks: Task[] = [
      { title: 'Deploy', priority: 'high', type: 'code', context: 'Ship it', status: 'pending', dependsOn: ['Build', 'Test'] },
    ];
    const result = serializeTasksFile(tasks);
    expect(result).toContain('**Depends on:** Build, Test');
  });

  it('serializes multiple tasks separated by ---', () => {
    const tasks: Task[] = [
      { title: 'Task A', priority: 'high', type: 'code', context: 'First', status: 'pending' },
      { title: 'Task B', priority: 'low', type: 'docs', context: 'Second', status: 'completed' },
    ];
    const result = serializeTasksFile(tasks);
    expect(result).toContain('## [ ] Task A');
    expect(result).toContain('\n\n---\n\n');
    expect(result).toContain('## [x] Task B');
  });

  it('round-trip: parse -> serialize -> parse produces equivalent tasks', () => {
    const markdown = `# Nightly Task Queue\n\n---\n\n## [ ] Alpha task
**Priority:** high
**Type:** code
**Context:** Do alpha things

---

## [x] Beta task
**Priority:** medium
**Type:** test
**Context:** Test beta
**Depends on:** Alpha task
`;
    const parsed = parseTasksFile(markdown);
    const serialized = serializeTasksFile(parsed);
    const reparsed = parseTasksFile(serialized);

    expect(reparsed).toEqual(parsed);
  });

  it('empty task array produces the header only', () => {
    const result = serializeTasksFile([]);
    expect(result).toBe(HEADER);
  });
});
