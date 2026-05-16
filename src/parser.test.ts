import { describe, it, expect } from 'vitest';
import { parseTasksFile } from './parser.js';

describe('parseTasksFile', () => {
  it('returns empty array for empty content', () => {
    expect(parseTasksFile('')).toEqual([]);
  });

  it('returns empty array for whitespace-only content', () => {
    expect(parseTasksFile('   \n\n  ')).toEqual([]);
  });

  it('parses a single pending task correctly', () => {
    const content = `## [ ] Build the login page
**Priority:** high
**Type:** code
**Context:** Create a responsive login form with email and password fields.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual({
      title: 'Build the login page',
      priority: 'high',
      type: 'code',
      context: 'Create a responsive login form with email and password fields.',
      status: 'pending',
    });
  });

  it('parses a completed task', () => {
    const content = `## [x] Setup CI pipeline
**Priority:** medium
**Type:** code
**Context:** Configure GitHub Actions for automated testing.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('completed');
    expect(tasks[0].title).toBe('Setup CI pipeline');
  });

  it('parses a failed task', () => {
    const content = `## [!] Deploy to staging
**Priority:** high
**Type:** code
**Context:** Deploy current build to staging environment.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('failed');
    expect(tasks[0].title).toBe('Deploy to staging');
  });

  it('parses multiple tasks of different statuses', () => {
    const content = `## [ ] Pending task
**Priority:** low
**Type:** docs
**Context:** Write documentation.

---

## [x] Done task
**Priority:** high
**Type:** test
**Context:** Tests are passing.

---

## [!] Broken task
**Priority:** medium
**Type:** refactor
**Context:** Refactoring broke something.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].status).toBe('pending');
    expect(tasks[0].priority).toBe('low');
    expect(tasks[0].type).toBe('docs');
    expect(tasks[1].status).toBe('completed');
    expect(tasks[1].priority).toBe('high');
    expect(tasks[1].type).toBe('test');
    expect(tasks[2].status).toBe('failed');
    expect(tasks[2].priority).toBe('medium');
    expect(tasks[2].type).toBe('refactor');
  });

  it('parses task with dependencies as array', () => {
    const content = `## [ ] Run integration tests
**Priority:** medium
**Type:** test
**Context:** Run full integration test suite.
**Depends on:** Build the app, Setup database
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dependsOn).toEqual(['Build the app', 'Setup database']);
  });

  it('parses task with single dependency', () => {
    const content = `## [ ] Deploy
**Priority:** high
**Type:** code
**Context:** Deploy to production.
**Depends on:** Run tests
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dependsOn).toEqual(['Run tests']);
  });

  it('task without depends on field has no dependsOn property', () => {
    const content = `## [ ] Independent task
**Priority:** high
**Type:** code
**Context:** Standalone work.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dependsOn).toBeUndefined();
  });

  it('assigns medium priority for missing or invalid priority field', () => {
    const content = `## [ ] No priority task
**Type:** code
**Context:** Missing priority.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('medium');
  });

  it('assigns medium priority for invalid priority value', () => {
    const content = `## [ ] Invalid priority
**Priority:** urgent
**Type:** code
**Context:** Invalid priority value.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('medium');
  });

  it('assigns code type for missing or invalid type field', () => {
    const content = `## [ ] No type task
**Priority:** high
**Context:** Missing type.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('code');
  });

  it('assigns code type for invalid type value', () => {
    const content = `## [ ] Invalid type
**Priority:** high
**Type:** deployment
**Context:** Invalid type value.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('code');
  });

  it('assigns empty string for missing context', () => {
    const content = `## [ ] No context
**Priority:** high
**Type:** code
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].context).toBe('');
  });

  it('ignores non-task sections (headers without status marker)', () => {
    const content = `# Project Title

Some introductory text.

## Overview

This is just a section heading, not a task.

## [ ] Actual task
**Priority:** high
**Type:** code
**Context:** This one is real.

## Another non-task heading

More text here.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Actual task');
  });

  it('content inside HTML comments with task-like headers still gets parsed', () => {
    // The parser does a simple split on "## " and does not strip HTML comments.
    // A template inside a comment that matches the header format will be parsed.
    const content = `## [ ] Real task
**Priority:** high
**Type:** code
**Context:** Something real.

<!-- INSTRUCTIONS:
  Copy the template below for each new task.

## [ ] Task title
**Priority:** high | medium | low
**Type:** code | research | docs | refactor | test | design
-->
`;
    const tasks = parseTasksFile(content);
    // The template inside the comment also matches, so 2 tasks are returned
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Real task');
    expect(tasks[0].priority).toBe('high');
  });

  it('HTML comments without task headers are ignored', () => {
    const content = `## [ ] Real task
**Priority:** high
**Type:** code
**Context:** Something real.

<!-- This is just a plain comment with no ## header -->
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Real task');
  });

  it('parses real-world TASKS.md format', () => {
    const content = `# Nightly Task Queue

> Add tasks below before sleeping. The orchestrator processes these top-to-bottom,
> running independent tasks in parallel. Mark completed tasks with [x].

---

## [ ] Scaffold the project structure
**Priority:** high
**Type:** code
**Context:** Create the initial folder layout, package.json, and base configuration files for the cowork project.

---

## [ ] Write unit tests for core utilities
**Priority:** medium
**Type:** test
**Context:** Add tests for any utility functions created during scaffolding. Target 80%+ coverage.
**Depends on:** Scaffold the project structure

---
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(2);

    expect(tasks[0].title).toBe('Scaffold the project structure');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].type).toBe('code');
    expect(tasks[0].status).toBe('pending');
    expect(tasks[0].dependsOn).toBeUndefined();

    expect(tasks[1].title).toBe('Write unit tests for core utilities');
    expect(tasks[1].priority).toBe('medium');
    expect(tasks[1].type).toBe('test');
    expect(tasks[1].status).toBe('pending');
    expect(tasks[1].dependsOn).toEqual(['Scaffold the project structure']);
  });

  it('handles field format with colon outside bold markers', () => {
    const content = `## [ ] Alternative format task
**Priority**: high
**Type**: design
**Context**: Uses colon outside bold markers.
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].type).toBe('design');
    expect(tasks[0].context).toBe('Uses colon outside bold markers.');
  });

  it('handles fields with list-item prefix', () => {
    const content = `## [ ] List style fields
- **Priority:** low
- **Type:** research
- **Context:** Fields can have leading dash.
- **Depends on:** Other task
`;
    const tasks = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('low');
    expect(tasks[0].type).toBe('research');
    expect(tasks[0].context).toBe('Fields can have leading dash.');
    expect(tasks[0].dependsOn).toEqual(['Other task']);
  });
});
