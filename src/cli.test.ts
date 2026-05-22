import { describe, it, expect } from 'vitest';
import { run } from './cli.js';

function makeTasks(...entries: Array<{ title: string; status?: string; priority?: string; type?: string; dependsOn?: string[] }>): string {
  return entries.map(e => {
    const marker = e.status === 'completed' ? 'x' : e.status === 'failed' ? '!' : ' ';
    const lines = [
      `## [${marker}] ${e.title}`,
      `**Priority:** ${e.priority ?? 'medium'}`,
      `**Type:** ${e.type ?? 'code'}`,
      `**Context:** Some context`,
    ];
    if (e.dependsOn && e.dependsOn.length > 0) {
      lines.push(`**Depends on:** ${e.dependsOn.join(', ')}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

describe('CLI run()', () => {
  describe('status command', () => {
    it('shows counts grouped by status with mixed statuses', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed' },
        { title: 'Task C', status: 'pending' },
        { title: 'Task D', status: 'failed' },
        { title: 'Task E', status: 'completed' },
      );

      const output = run(['status'], content);

      expect(output).toContain('Task Status:');
      expect(output).toContain('Pending:');
      expect(output).toContain('Completed:');
      expect(output).toContain('Failed:');
      expect(output).toContain('Skipped:');
      expect(output).toContain('Total:');
      expect(output).toMatch(/Pending:\s+2/);
      expect(output).toMatch(/Completed:\s+2/);
      expect(output).toMatch(/Failed:\s+1/);
      expect(output).toMatch(/Skipped:\s+0/);
      expect(output).toMatch(/Total:\s+5/);
    });

    it('shows all zeros for empty task list', () => {
      const output = run(['status'], '');

      expect(output).toContain('Task Status:');
      expect(output).toMatch(/Pending:\s+0/);
      expect(output).toMatch(/Completed:\s+0/);
      expect(output).toMatch(/Failed:\s+0/);
      expect(output).toMatch(/Skipped:\s+0/);
      expect(output).toMatch(/Total:\s+0/);
    });
  });

  describe('plan command', () => {
    it('shows execution plan with pending tasks', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'medium' },
      );

      const output = run(['plan'], content);

      expect(output).toContain('Execution Plan:');
      expect(output).toContain('Batch 1');
      expect(output).toContain('[high] Task A');
      expect(output).toContain('[medium] Task B');
    });

    it('shows no pending tasks message when all completed', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'completed' },
        { title: 'Task B', status: 'completed' },
      );

      const output = run(['plan'], content);

      expect(output).toBe('No pending tasks to plan.');
    });

    it('shows dependency info in plan', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'low', dependsOn: ['Task A'] },
      );

      const output = run(['plan'], content);

      expect(output).toContain('Execution Plan:');
      expect(output).toContain('Batch 1');
      expect(output).toContain('[high] Task A');
      expect(output).toContain('Batch 2');
      expect(output).toContain('[low] Task B (depends on: Task A)');
    });
  });

  describe('validate command', () => {
    it('shows no issues message when validation passes', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'pending' },
      );

      const output = run(['validate'], content);

      expect(output).toBe('Validation passed — no issues found.');
    });

    it('shows errors when validation finds them', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
      );

      const output = run(['validate'], content);

      expect(output).toContain('Validation Results:');
      expect(output).toContain('Errors (1):');
      expect(output).toContain('[duplicate-title]');
      expect(output).toContain('Duplicate task title: "Task A"');
    });

    it('shows warnings when validation finds them', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const output = run(['validate'], content);

      expect(output).toContain('Validation Results:');
      expect(output).toContain('Warnings (1):');
      expect(output).toContain('[completed-with-pending-dep]');
      expect(output).toContain('Completed task "Task B" has a pending dependency "Task A"');
    });

    it('shows both errors and warnings together', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const output = run(['validate'], content);

      expect(output).toContain('Validation Results:');
      expect(output).toContain('Errors');
      expect(output).toContain('Warnings');
    });
  });

  describe('usage', () => {
    it('shows usage when no command given', () => {
      const output = run([], '');

      expect(output).toContain('Usage: cowork <command>');
      expect(output).toContain('status');
      expect(output).toContain('plan');
      expect(output).toContain('validate');
    });

    it('shows usage for unknown command', () => {
      const output = run(['foobar'], '');

      expect(output).toContain('Usage: cowork <command>');
      expect(output).toContain('status');
      expect(output).toContain('plan');
      expect(output).toContain('validate');
    });
  });
});
