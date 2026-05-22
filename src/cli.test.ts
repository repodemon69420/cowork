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

      const result = run(['status'], content);

      expect(result.output).toContain('Task Status:');
      expect(result.output).toContain('Pending:');
      expect(result.output).toContain('Completed:');
      expect(result.output).toContain('Failed:');
      expect(result.output).toContain('Skipped:');
      expect(result.output).toContain('Total:');
      expect(result.output).toMatch(/Pending:\s+2/);
      expect(result.output).toMatch(/Completed:\s+2/);
      expect(result.output).toMatch(/Failed:\s+1/);
      expect(result.output).toMatch(/Skipped:\s+0/);
      expect(result.output).toMatch(/Total:\s+5/);
    });

    it('shows all zeros for empty task list', () => {
      const result = run(['status'], '');

      expect(result.output).toContain('Task Status:');
      expect(result.output).toMatch(/Pending:\s+0/);
      expect(result.output).toMatch(/Completed:\s+0/);
      expect(result.output).toMatch(/Failed:\s+0/);
      expect(result.output).toMatch(/Skipped:\s+0/);
      expect(result.output).toMatch(/Total:\s+0/);
    });

    it('always returns exitCode 0', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'failed' },
      );

      const result = run(['status'], content);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('plan command', () => {
    it('shows execution plan with pending tasks', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'medium' },
      );

      const result = run(['plan'], content);

      expect(result.output).toContain('Execution Plan:');
      expect(result.output).toContain('Batch 1');
      expect(result.output).toContain('[high] Task A');
      expect(result.output).toContain('[medium] Task B');
    });

    it('shows no pending tasks message when all completed', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'completed' },
        { title: 'Task B', status: 'completed' },
      );

      const result = run(['plan'], content);

      expect(result.output).toBe('No pending tasks to plan.');
    });

    it('shows dependency info in plan', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'low', dependsOn: ['Task A'] },
      );

      const result = run(['plan'], content);

      expect(result.output).toContain('Execution Plan:');
      expect(result.output).toContain('Batch 1');
      expect(result.output).toContain('[high] Task A');
      expect(result.output).toContain('Batch 2');
      expect(result.output).toContain('[low] Task B (depends on: Task A)');
    });

    it('always returns exitCode 0', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
      );

      const result = run(['plan'], content);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('validate command', () => {
    it('shows no issues message when validation passes', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'pending' },
      );

      const result = run(['validate'], content);

      expect(result.output).toBe('Validation passed — no issues found.');
    });

    it('shows errors when validation finds them', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
      );

      const result = run(['validate'], content);

      expect(result.output).toContain('Validation Results:');
      expect(result.output).toContain('Errors (1):');
      expect(result.output).toContain('[duplicate-title]');
      expect(result.output).toContain('Duplicate task title: "Task A"');
    });

    it('shows warnings when validation finds them', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const result = run(['validate'], content);

      expect(result.output).toContain('Validation Results:');
      expect(result.output).toContain('Warnings (1):');
      expect(result.output).toContain('[completed-with-pending-dep]');
      expect(result.output).toContain('Completed task "Task B" has a pending dependency "Task A"');
    });

    it('shows both errors and warnings together', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const result = run(['validate'], content);

      expect(result.output).toContain('Validation Results:');
      expect(result.output).toContain('Errors');
      expect(result.output).toContain('Warnings');
    });

    it('returns exitCode 1 when there are validation errors', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
      );

      const result = run(['validate'], content);
      expect(result.exitCode).toBe(1);
    });

    it('returns exitCode 0 when there are only warnings', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const result = run(['validate'], content);
      expect(result.exitCode).toBe(0);
    });

    it('returns exitCode 0 when there are no issues', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'pending' },
      );

      const result = run(['validate'], content);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('run command', () => {
    it('with active kill switch and valid tasks returns report with exitCode 0', () => {
      const content = '# Status: ON\n\n' + makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'medium' },
      );

      const result = run(['run'], content);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Overnight Session Report');
      expect(result.output).toContain('Task A');
      expect(result.output).toContain('Task B');
    });

    it('with OFF kill switch returns abort message with exitCode 0', () => {
      const content = '# Status: OFF\n\n' + makeTasks(
        { title: 'Task A', status: 'pending' },
      );

      const result = run(['run'], content);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Kill switch is OFF');
      expect(result.output).toContain('session aborted');
    });

    it('with validation errors returns errors with exitCode 1', () => {
      const content = '# Status: ON\n\n' + makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
      );

      const result = run(['run'], content);

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Validation Results:');
      expect(result.output).toContain('Errors');
      expect(result.output).toContain('duplicate-title');
    });

    it('--json with valid tasks returns JSON', () => {
      const content = '# Status: ON\n\n' + makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
      );

      const result = run(['run', '--json'], content);

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.output);
      expect(data).toHaveProperty('completed');
      expect(data).toHaveProperty('failed');
      expect(data).toHaveProperty('skipped');
    });

    it('--json with OFF kill switch returns JSON with aborted flag', () => {
      const content = '# Status: OFF\n\n' + makeTasks(
        { title: 'Task A', status: 'pending' },
      );

      const result = run(['run', '--json'], content);

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.output);
      expect(data).toHaveProperty('aborted', true);
      expect(data).toHaveProperty('reason');
    });
  });

  describe('add command', () => {
    it('with title generates task block with default priority/type', () => {
      const result = run(['add', 'Fix login bug']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('## [ ] Fix login bug');
      expect(result.output).toContain('**Priority:** medium');
      expect(result.output).toContain('**Type:** code');
    });

    it('with --priority and --type uses provided values', () => {
      const result = run(['add', 'Write tests', '--priority', 'high', '--type', 'test']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('**Priority:** high');
      expect(result.output).toContain('**Type:** test');
    });

    it('with --context includes context', () => {
      const result = run(['add', 'Refactor auth', '--context', 'Needs cleanup']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('**Context:** Needs cleanup');
    });

    it('without title returns usage with exitCode 1', () => {
      const result = run(['add']);

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Usage: cowork add');
    });

    it('--json returns valid JSON task object', () => {
      const result = run(['add', 'New feature', '--json', '--priority', 'low', '--type', 'research']);

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.output);
      expect(data).toEqual({
        title: 'New feature',
        priority: 'low',
        type: 'research',
        context: '',
        status: 'pending',
      });
    });
  });

  describe('usage', () => {
    it('shows usage when no command given', () => {
      const result = run([], '');

      expect(result.output).toContain('Usage: cowork <command>');
      expect(result.output).toContain('status');
      expect(result.output).toContain('plan');
      expect(result.output).toContain('validate');
      expect(result.output).toContain('run');
      expect(result.output).toContain('add');
    });

    it('shows usage for unknown command', () => {
      const result = run(['foobar'], '');

      expect(result.output).toContain('Usage: cowork <command>');
      expect(result.output).toContain('status');
      expect(result.output).toContain('plan');
      expect(result.output).toContain('validate');
    });
  });

  describe('--json flag', () => {
    it('status --json returns valid JSON with correct keys', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed' },
        { title: 'Task C', status: 'pending' },
      );

      const result = run(['status', '--json'], content);
      const data = JSON.parse(result.output);

      expect(data).toHaveProperty('pending', 2);
      expect(data).toHaveProperty('completed', 1);
      expect(data).toHaveProperty('failed', 0);
      expect(data).toHaveProperty('skipped', 0);
      expect(data).toHaveProperty('total', 3);
      expect(result.exitCode).toBe(0);
    });

    it('plan --json returns valid JSON array', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending', priority: 'high' },
        { title: 'Task B', status: 'pending', priority: 'medium', dependsOn: ['Task A'] },
      );

      const result = run(['plan', '--json'], content);
      const data = JSON.parse(result.output);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('batch');
      expect(data[0]).toHaveProperty('parallel');
      expect(data[0]).toHaveProperty('tasks');
      expect(data[0].tasks[0]).toHaveProperty('title');
      expect(data[0].tasks[0]).toHaveProperty('priority');
      expect(result.exitCode).toBe(0);
    });

    it('validate --json returns valid JSON with errors and warnings arrays', () => {
      const content = makeTasks(
        { title: 'Task A', status: 'pending' },
        { title: 'Task A', status: 'pending' },
        { title: 'Task B', status: 'completed', dependsOn: ['Task A'] },
      );

      const result = run(['validate', '--json'], content);
      const data = JSON.parse(result.output);

      expect(Array.isArray(data.errors)).toBe(true);
      expect(Array.isArray(data.warnings)).toBe(true);
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.warnings.length).toBeGreaterThan(0);
      expect(result.exitCode).toBe(1);
    });
  });
});
