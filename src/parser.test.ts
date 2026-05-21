import { describe, it, expect } from 'vitest';
import { parseTasksFile, parseTasksFileSimple } from './parser.js';

describe('parseTasksFile', () => {
  it('returns empty result for empty content', () => {
    expect(parseTasksFile('')).toEqual({ tasks: [], warnings: [] });
  });

  it('returns empty result for whitespace-only content', () => {
    expect(parseTasksFile('   \n\n  ')).toEqual({ tasks: [], warnings: [] });
  });

  it('parses a single pending task correctly', () => {
    const content = `## [ ] Build the login page
**Priority:** high
**Type:** code
**Context:** Create a responsive login form with email and password fields.
`;
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dependsOn).toEqual(['Run tests']);
  });

  it('task without depends on field has no dependsOn property', () => {
    const content = `## [ ] Independent task
**Priority:** high
**Type:** code
**Context:** Standalone work.
`;
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dependsOn).toBeUndefined();
  });

  it('assigns medium priority for missing or invalid priority field', () => {
    const content = `## [ ] No priority task
**Type:** code
**Context:** Missing priority.
`;
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('medium');
  });

  it('assigns medium priority for invalid priority value', () => {
    const content = `## [ ] Invalid priority
**Priority:** urgent
**Type:** code
**Context:** Invalid priority value.
`;
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('medium');
  });

  it('assigns code type for missing or invalid type field', () => {
    const content = `## [ ] No type task
**Priority:** high
**Context:** Missing type.
`;
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('code');
  });

  it('assigns code type for invalid type value', () => {
    const content = `## [ ] Invalid type
**Priority:** high
**Type:** deployment
**Context:** Invalid type value.
`;
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('code');
  });

  it('assigns empty string for missing context', () => {
    const content = `## [ ] No context
**Priority:** high
**Type:** code
`;
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
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
    const { tasks } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('low');
    expect(tasks[0].type).toBe('research');
    expect(tasks[0].context).toBe('Fields can have leading dash.');
    expect(tasks[0].dependsOn).toEqual(['Other task']);
  });
});

describe('parseTasksFile warnings', () => {
  it('returns no warnings for a fully valid task', () => {
    const content = `## [ ] Valid task
**Priority:** high
**Type:** code
**Context:** Everything is valid here.
`;
    const { warnings } = parseTasksFile(content);
    expect(warnings).toEqual([]);
  });

  it('warns when priority is missing and gets defaulted', () => {
    const content = `## [ ] No priority task
**Type:** code
**Context:** Missing priority.
`;
    const { warnings } = parseTasksFile(content);
    const priorityWarning = warnings.find(w => w.field === 'priority');
    expect(priorityWarning).toBeDefined();
    expect(priorityWarning!.taskTitle).toBe('No priority task');
    expect(priorityWarning!.message).toContain('Missing priority');
    expect(priorityWarning!.message).toContain('medium');
  });

  it('warns when priority is unrecognized and gets defaulted', () => {
    const content = `## [ ] Bad priority task
**Priority:** urgent
**Type:** code
**Context:** Invalid priority value.
`;
    const { warnings } = parseTasksFile(content);
    const priorityWarning = warnings.find(w => w.field === 'priority');
    expect(priorityWarning).toBeDefined();
    expect(priorityWarning!.taskTitle).toBe('Bad priority task');
    expect(priorityWarning!.message).toContain('Unrecognized priority');
    expect(priorityWarning!.message).toContain('urgent');
    expect(priorityWarning!.message).toContain('medium');
  });

  it('warns when type is missing and gets defaulted', () => {
    const content = `## [ ] No type task
**Priority:** high
**Context:** Missing type.
`;
    const { warnings } = parseTasksFile(content);
    const typeWarning = warnings.find(w => w.field === 'type');
    expect(typeWarning).toBeDefined();
    expect(typeWarning!.taskTitle).toBe('No type task');
    expect(typeWarning!.message).toContain('Missing type');
    expect(typeWarning!.message).toContain('code');
  });

  it('warns when type is unrecognized and gets defaulted', () => {
    const content = `## [ ] Bad type task
**Priority:** high
**Type:** deployment
**Context:** Invalid type value.
`;
    const { warnings } = parseTasksFile(content);
    const typeWarning = warnings.find(w => w.field === 'type');
    expect(typeWarning).toBeDefined();
    expect(typeWarning!.taskTitle).toBe('Bad type task');
    expect(typeWarning!.message).toContain('Unrecognized type');
    expect(typeWarning!.message).toContain('deployment');
    expect(typeWarning!.message).toContain('code');
  });

  it('warns when context is empty', () => {
    const content = `## [ ] No context task
**Priority:** high
**Type:** code
`;
    const { warnings } = parseTasksFile(content);
    const contextWarning = warnings.find(w => w.field === 'context');
    expect(contextWarning).toBeDefined();
    expect(contextWarning!.taskTitle).toBe('No context task');
    expect(contextWarning!.message).toContain('Context is empty');
  });

  it('warns when a dependsOn reference does not match any task title', () => {
    const content = `## [ ] Orphan task
**Priority:** high
**Type:** code
**Context:** Depends on something that does not exist.
**Depends on:** Non-existent task
`;
    const { warnings } = parseTasksFile(content);
    const depWarning = warnings.find(w => w.field === 'dependsOn');
    expect(depWarning).toBeDefined();
    expect(depWarning!.taskTitle).toBe('Orphan task');
    expect(depWarning!.message).toContain('Non-existent task');
    expect(depWarning!.message).toContain('does not match any task title');
  });

  it('does not warn when dependsOn references a valid task title', () => {
    const content = `## [ ] First task
**Priority:** high
**Type:** code
**Context:** The first one.

## [ ] Second task
**Priority:** medium
**Type:** code
**Context:** Depends on the first.
**Depends on:** First task
`;
    const { warnings } = parseTasksFile(content);
    const depWarning = warnings.find(w => w.field === 'dependsOn');
    expect(depWarning).toBeUndefined();
  });

  it('warns when a task title is duplicated', () => {
    const content = `## [ ] Duplicate task
**Priority:** high
**Type:** code
**Context:** First occurrence.

## [ ] Duplicate task
**Priority:** low
**Type:** docs
**Context:** Second occurrence.
`;
    const { warnings } = parseTasksFile(content);
    const titleWarning = warnings.find(w => w.field === 'title');
    expect(titleWarning).toBeDefined();
    expect(titleWarning!.taskTitle).toBe('Duplicate task');
    expect(titleWarning!.message).toContain('Duplicate task title');
  });

  it('collects multiple warnings for a single task', () => {
    const content = `## [ ] Bad task
`;
    const { tasks, warnings } = parseTasksFile(content);
    expect(tasks).toHaveLength(1);
    // Missing priority, missing type, missing context
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    const fields = warnings.map(w => w.field);
    expect(fields).toContain('priority');
    expect(fields).toContain('type');
    expect(fields).toContain('context');
  });

  it('collects warnings across multiple tasks', () => {
    const content = `## [ ] Task A
**Priority:** urgent
**Type:** code
**Context:** Valid context.

## [ ] Task B
**Priority:** high
**Type:** deployment
**Context:** Valid context.
`;
    const { warnings } = parseTasksFile(content);
    expect(warnings).toHaveLength(2);
    expect(warnings[0].taskTitle).toBe('Task A');
    expect(warnings[0].field).toBe('priority');
    expect(warnings[1].taskTitle).toBe('Task B');
    expect(warnings[1].field).toBe('type');
  });

  it('warns for multiple unresolved dependencies in a single task', () => {
    const content = `## [ ] Lonely task
**Priority:** high
**Type:** code
**Context:** Has two missing deps.
**Depends on:** Ghost A, Ghost B
`;
    const { warnings } = parseTasksFile(content);
    const depWarnings = warnings.filter(w => w.field === 'dependsOn');
    expect(depWarnings).toHaveLength(2);
    expect(depWarnings[0].message).toContain('Ghost A');
    expect(depWarnings[1].message).toContain('Ghost B');
  });

  it('returns ParseResult shape with tasks and warnings arrays', () => {
    const result = parseTasksFile('');
    expect(result).toHaveProperty('tasks');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.tasks)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

describe('parseTasksFileSimple', () => {
  it('returns just the tasks array', () => {
    const content = `## [ ] Simple task
**Priority:** high
**Type:** code
**Context:** Backward compatibility.
`;
    const tasks = parseTasksFileSimple(content);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Simple task');
  });

  it('returns empty array for empty content', () => {
    expect(parseTasksFileSimple('')).toEqual([]);
  });

  it('matches parseTasksFile tasks output', () => {
    const content = `## [ ] Task A
**Priority:** high
**Type:** code
**Context:** First.

## [ ] Task B
**Priority:** low
**Type:** docs
**Context:** Second.
`;
    const simpleTasks = parseTasksFileSimple(content);
    const { tasks } = parseTasksFile(content);
    expect(simpleTasks).toEqual(tasks);
  });
});
