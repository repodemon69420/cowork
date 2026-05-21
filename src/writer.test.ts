import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateTaskStatus, appendTask } from './writer.js';
import { parseTasksFileSimple } from './parser.js';
import type { Task } from './types.js';

describe('updateTaskStatus', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'writer-test-'));
    filePath = join(tempDir, 'TASKS.md');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('marks a pending task as completed', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Build the login page
**Priority:** high
**Type:** code
**Context:** Create a responsive login form.

---
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Build the login page', 'completed');

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [x] Build the login page');
    expect(result).not.toContain('## [ ] Build the login page');
  });

  it('marks a pending task as failed', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Deploy to staging
**Priority:** high
**Type:** code
**Context:** Deploy current build.

---
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Deploy to staging', 'failed');

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [!] Deploy to staging');
    expect(result).not.toContain('## [ ] Deploy to staging');
  });

  it('throws an error when task is not found', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Existing task
**Priority:** high
**Type:** code
**Context:** Some context.

---
`;
    await writeFile(filePath, content, 'utf-8');

    await expect(
      updateTaskStatus(filePath, 'Nonexistent task', 'completed')
    ).rejects.toThrow('Task not found: "Nonexistent task"');
  });

  it('preserves other tasks unchanged', async () => {
    const content = `# Nightly Task Queue

---

## [ ] First task
**Priority:** high
**Type:** code
**Context:** First context.

---

## [ ] Second task
**Priority:** medium
**Type:** test
**Context:** Second context.
**Depends on:** First task

---

## [x] Already done
**Priority:** low
**Type:** docs
**Context:** Third context.

---
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Second task', 'completed');

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [ ] First task');
    expect(result).toContain('## [x] Second task');
    expect(result).toContain('## [x] Already done');
    // Verify context and other fields are preserved
    expect(result).toContain('**Context:** First context.');
    expect(result).toContain('**Context:** Second context.');
    expect(result).toContain('**Depends on:** First task');
  });

  it('marks a completed task back to pending', async () => {
    const content = `## [x] Completed task
**Priority:** high
**Type:** code
**Context:** Was done.
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Completed task', 'pending');

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [ ] Completed task');
  });

  it('marks a failed task as completed', async () => {
    const content = `## [!] Failed task
**Priority:** high
**Type:** code
**Context:** Was broken.
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Failed task', 'completed');

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [x] Failed task');
  });
});

describe('appendTask', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'writer-test-'));
    filePath = join(tempDir, 'TASKS.md');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('appends a task to the end of the file', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Existing task
**Priority:** high
**Type:** code
**Context:** Already here.

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'New task',
      priority: 'medium',
      type: 'test',
      context: 'A brand new task.',
      status: 'pending',
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [ ] New task');
    expect(result).toContain('**Priority:** medium');
    expect(result).toContain('**Type:** test');
    expect(result).toContain('**Context:** A brand new task.');
    // Original content should still be present
    expect(result).toContain('## [ ] Existing task');
  });

  it('includes all task fields including priority, type, context, and dependsOn', async () => {
    const content = `# Nightly Task Queue

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Full task',
      priority: 'high',
      type: 'code',
      context: 'Comprehensive task with all fields.',
      status: 'pending',
      dependsOn: ['First dependency', 'Second dependency'],
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [ ] Full task');
    expect(result).toContain('**Priority:** high');
    expect(result).toContain('**Type:** code');
    expect(result).toContain('**Context:** Comprehensive task with all fields.');
    expect(result).toContain('**Depends on:** First dependency, Second dependency');
  });

  it('appends a completed task with [x] marker', async () => {
    const content = `# Nightly Task Queue

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Done task',
      priority: 'low',
      type: 'docs',
      context: 'Already completed.',
      status: 'completed',
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [x] Done task');
  });

  it('appends a failed task with [!] marker', async () => {
    const content = `# Nightly Task Queue

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Broken task',
      priority: 'high',
      type: 'code',
      context: 'This one failed.',
      status: 'failed',
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).toContain('## [!] Broken task');
  });

  it('omits Depends on field when dependsOn is undefined', async () => {
    const content = `# Tasks\n`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Independent task',
      priority: 'medium',
      type: 'research',
      context: 'No dependencies.',
      status: 'pending',
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).not.toContain('**Depends on:**');
  });

  it('omits Depends on field when dependsOn is an empty array', async () => {
    const content = `# Tasks\n`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'No deps task',
      priority: 'medium',
      type: 'code',
      context: 'Empty deps.',
      status: 'pending',
      dependsOn: [],
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    expect(result).not.toContain('**Depends on:**');
  });
});

describe('round-trip: write then parse back', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'writer-test-'));
    filePath = join(tempDir, 'TASKS.md');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('appended task can be parsed back correctly', async () => {
    const content = `# Nightly Task Queue

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Round-trip task',
      priority: 'high',
      type: 'refactor',
      context: 'Test the round-trip.',
      status: 'pending',
      dependsOn: ['Some other task'],
    };
    await appendTask(filePath, newTask);

    const result = await readFile(filePath, 'utf-8');
    const tasks = parseTasksFileSimple(result);

    const found = tasks.find(t => t.title === 'Round-trip task');
    expect(found).toBeDefined();
    expect(found!.priority).toBe('high');
    expect(found!.type).toBe('refactor');
    expect(found!.context).toBe('Test the round-trip.');
    expect(found!.status).toBe('pending');
    expect(found!.dependsOn).toEqual(['Some other task']);
  });

  it('updated status is reflected when parsed back', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Parse me
**Priority:** medium
**Type:** test
**Context:** Should become completed.

---
`;
    await writeFile(filePath, content, 'utf-8');
    await updateTaskStatus(filePath, 'Parse me', 'completed');

    const result = await readFile(filePath, 'utf-8');
    const tasks = parseTasksFileSimple(result);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Parse me');
    expect(tasks[0].status).toBe('completed');
  });

  it('append then update then parse preserves everything', async () => {
    const content = `# Nightly Task Queue

---

## [ ] Original task
**Priority:** high
**Type:** code
**Context:** The first task.

---
`;
    await writeFile(filePath, content, 'utf-8');

    const newTask: Task = {
      title: 'Added task',
      priority: 'low',
      type: 'docs',
      context: 'Documentation work.',
      status: 'pending',
    };
    await appendTask(filePath, newTask);
    await updateTaskStatus(filePath, 'Original task', 'completed');
    await updateTaskStatus(filePath, 'Added task', 'failed');

    const result = await readFile(filePath, 'utf-8');
    const tasks = parseTasksFileSimple(result);

    expect(tasks).toHaveLength(2);

    const original = tasks.find(t => t.title === 'Original task');
    expect(original).toBeDefined();
    expect(original!.status).toBe('completed');
    expect(original!.priority).toBe('high');

    const added = tasks.find(t => t.title === 'Added task');
    expect(added).toBeDefined();
    expect(added!.status).toBe('failed');
    expect(added!.priority).toBe('low');
    expect(added!.type).toBe('docs');
  });
});
