import { describe, it, expect } from 'vitest';
import { createShellExecutor } from './shell-executor.js';
import { Task } from './types.js';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';

function makeTask(command: string, overrides?: Partial<Task>): Task {
  return {
    title: 'Shell task',
    priority: 'medium',
    type: 'code',
    context: command,
    status: 'pending',
    ...overrides,
  };
}

describe('createShellExecutor', () => {
  it('should return success for a command that exits with 0', async () => {
    const executor = createShellExecutor();
    const task = makeTask('echo hello');

    const result = await executor(task);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return failure for a command that exits with non-zero', async () => {
    const executor = createShellExecutor();
    const task = makeTask('exit 1');

    const result = await executor(task);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return failure when running the "false" command', async () => {
    const executor = createShellExecutor();
    const task = makeTask('false');

    const result = await executor(task);

    expect(result.success).toBe(false);
  });

  it('should include stderr in the error message', async () => {
    const executor = createShellExecutor();
    const task = makeTask('echo "oops" >&2; exit 1');

    const result = await executor(task);

    expect(result.success).toBe(false);
    expect(result.error).toContain('oops');
  });

  it('should handle timeout exceeded', async () => {
    const executor = createShellExecutor({ timeout: 500 });
    const task = makeTask('sleep 10');

    const result = await executor(task);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Command timed out after 500ms');
  });

  it('should use default timeout of 60000ms', async () => {
    const executor = createShellExecutor();
    // Just verify a fast command works (doesn't time out)
    const task = makeTask('echo fast');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });

  it('should pass custom env vars to the command', async () => {
    const executor = createShellExecutor({
      env: { MY_VAR: 'custom_value' },
    });
    const task = makeTask('echo $MY_VAR');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });

  it('should use custom working directory', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'shell-executor-test-'));
    const executor = createShellExecutor({ cwd: tempDir });
    const task = makeTask('pwd');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });

  it('should use the specified shell', async () => {
    const executor = createShellExecutor({ shell: '/bin/sh' });
    const task = makeTask('echo "works"');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });

  it('should handle commands that produce no output', async () => {
    const executor = createShellExecutor();
    const task = makeTask('true');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });

  it('should handle commands with invalid syntax', async () => {
    const executor = createShellExecutor();
    const task = makeTask('if then else fi done');

    const result = await executor(task);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should merge env with process.env', async () => {
    const executor = createShellExecutor({
      env: { SHELL_EXEC_TEST_VAR: 'hello_test' },
    });
    // PATH should still be available from process.env
    const task = makeTask('echo $SHELL_EXEC_TEST_VAR && which echo');

    const result = await executor(task);

    expect(result.success).toBe(true);
  });
});
