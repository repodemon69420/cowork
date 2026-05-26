import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, run, CliOptions, formatSummary } from './cli.js';

const VALID_TASKS_CONTENT = `# Nightly Task Queue

## [ ] Set up database
- **Priority:** high
- **Type:** code
- **Context:** Initialize PostgreSQL schema

---

## [ ] Write API docs
- **Priority:** medium
- **Type:** docs
- **Context:** Document REST endpoints

---
`;

const INVALID_TASKS_CONTENT = `# Nightly Task Queue

## [ ] Task A
- **Priority:** high
- **Type:** code
- **Context:**

---

## [ ] Task A
- **Priority:** medium
- **Type:** code
- **Context:** Duplicate title

---
`;

describe('parseArgs', () => {
  it('returns default values when no args provided', () => {
    const options = parseArgs([]);
    expect(options).toEqual({
      tasksPath: './TASKS.md',
      outputPath: './MORNING_REPORT.md',
      dryRun: false,
      validate: false,
      help: false,
      quiet: false,
    });
  });

  it('--tasks sets tasksPath', () => {
    const options = parseArgs(['--tasks', '/path/to/tasks.md']);
    expect(options.tasksPath).toBe('/path/to/tasks.md');
  });

  it('--output sets outputPath', () => {
    const options = parseArgs(['--output', '/path/to/report.md']);
    expect(options.outputPath).toBe('/path/to/report.md');
  });

  it('--dry-run sets dryRun to true', () => {
    const options = parseArgs(['--dry-run']);
    expect(options.dryRun).toBe(true);
  });

  it('--validate sets validate to true', () => {
    const options = parseArgs(['--validate']);
    expect(options.validate).toBe(true);
  });

  it('--help sets help to true', () => {
    const options = parseArgs(['--help']);
    expect(options.help).toBe(true);
  });

  it('--quiet sets quiet to true', () => {
    const options = parseArgs(['--quiet']);
    expect(options.quiet).toBe(true);
  });

  it('handles multiple flags combined', () => {
    const options = parseArgs([
      '--tasks', 'my-tasks.md',
      '--output', 'my-report.md',
      '--dry-run',
      '--validate',
      '--help',
    ]);
    expect(options).toEqual({
      tasksPath: 'my-tasks.md',
      outputPath: 'my-report.md',
      dryRun: true,
      validate: true,
      help: true,
      quiet: false,
    });
  });

  it('--config sets configPath', () => {
    const options = parseArgs(['--config', '/path/to/config.json']);
    expect(options.configPath).toBe('/path/to/config.json');
  });
});

describe('run', () => {
  let tempDir: string;
  let stdoutOutput: string;
  let stderrOutput: string;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-cli-test-'));
    stdoutOutput = '';
    stderrOutput = '';
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(async () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeOptions(overrides: Partial<CliOptions> = {}): CliOptions {
    return {
      tasksPath: join(tempDir, 'TASKS.md'),
      outputPath: join(tempDir, 'MORNING_REPORT.md'),
      dryRun: false,
      validate: false,
      help: false,
      quiet: false,
      ...overrides,
    };
  }

  it('help mode prints usage', async () => {
    await run(makeOptions({ help: true }));
    expect(stdoutOutput).toContain('--tasks');
    expect(stdoutOutput).toContain('--output');
    expect(stdoutOutput).toContain('--dry-run');
    expect(stdoutOutput).toContain('--validate');
    expect(stdoutOutput).toContain('--quiet');
    expect(stdoutOutput).toContain('--help');
  });

  it('validate mode with valid tasks reports no errors', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    await run(makeOptions({ validate: true, tasksPath }));
    expect(stdoutOutput).toMatch(/valid|no errors|pass/i);
  });

  it('validate mode with invalid tasks reports errors', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    await fsWriteFile(tasksPath, INVALID_TASKS_CONTENT, 'utf-8');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      await run(makeOptions({ validate: true, tasksPath }));
    } catch {
      // expected from mocked process.exit
    }

    expect(stderrOutput).toMatch(/error|invalid|duplicate/i);
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('dry-run mode prints execution plan', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    await run(makeOptions({ dryRun: true, tasksPath }));
    expect(stdoutOutput).toContain('Set up database');
    expect(stdoutOutput).toContain('Write API docs');
    expect(stdoutOutput).toMatch(/batch/i);
  });

  it('full run writes report file', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    const outputPath = join(tempDir, 'MORNING_REPORT.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    await run(makeOptions({ tasksPath, outputPath }));

    const reportContent = await fsReadFile(outputPath, 'utf-8');
    expect(reportContent).toContain('Overnight Session Report');

    // Verify TASKS.md was updated with completed statuses
    const updatedTasks = await fsReadFile(tasksPath, 'utf-8');
    expect(updatedTasks).toContain('[x] Set up database');
    expect(updatedTasks).toContain('[x] Write API docs');
    expect(updatedTasks).not.toContain('[ ] Set up database');
    expect(updatedTasks).not.toContain('[ ] Write API docs');

    // Verify progress messages were printed
    expect(stdoutOutput).toMatch(/Executing batch \d+\/\d+/);
    expect(stdoutOutput).toContain('[DONE]');
    expect(stdoutOutput).toMatch(/Summary: \d+ completed/);
  });

  it('quiet mode suppresses progress but still writes report', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    const outputPath = join(tempDir, 'MORNING_REPORT.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    await run(makeOptions({ tasksPath, outputPath, quiet: true }));

    const reportContent = await fsReadFile(outputPath, 'utf-8');
    expect(reportContent).toContain('Overnight Session Report');

    // Quiet mode should NOT print batch progress or summary
    expect(stdoutOutput).not.toMatch(/Executing batch/);
    expect(stdoutOutput).not.toContain('[DONE]');
    expect(stdoutOutput).not.toMatch(/Summary:/);

    // But should still print the report path
    expect(stdoutOutput).toContain('Report written to');
  });

  it('normal mode shows batch headers and task results', async () => {
    const tasksPath = join(tempDir, 'TASKS.md');
    const outputPath = join(tempDir, 'MORNING_REPORT.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    await run(makeOptions({ tasksPath, outputPath }));

    expect(stdoutOutput).toContain('Executing batch 1/');
    expect(stdoutOutput).toContain('[DONE] Set up database');
    expect(stdoutOutput).toContain('[DONE] Write API docs');
    expect(stdoutOutput).toMatch(/Summary: 2 completed, 0 failed, 0 skipped/);
    expect(stdoutOutput).toContain('Report written to');
  });

  it('handles missing tasks file with error message', async () => {
    const tasksPath = join(tempDir, 'nonexistent.md');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      await run(makeOptions({ tasksPath }));
    } catch {
      // expected from mocked process.exit
    }

    expect(stderrOutput).toMatch(/not found|error|no such/i);
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('run loads config and uses config values for paths', async () => {
    const tasksPath = join(tempDir, 'custom-tasks.md');
    const outputPath = join(tempDir, 'custom-report.md');
    await fsWriteFile(tasksPath, VALID_TASKS_CONTENT, 'utf-8');

    const configPath = join(tempDir, '.coworkrc.json');
    await fsWriteFile(configPath, JSON.stringify({
      tasksPath,
      outputPath,
    }), 'utf-8');

    // Use default paths in CLI options (so config values take precedence)
    await run(makeOptions({ configPath, tasksPath: './TASKS.md', outputPath: './MORNING_REPORT.md' }));

    const reportContent = await fsReadFile(outputPath, 'utf-8');
    expect(reportContent).toContain('Overnight Session Report');
  });

  it('CLI flags override config file values', async () => {
    const configTasksPath = join(tempDir, 'config-tasks.md');
    const cliTasksPath = join(tempDir, 'cli-tasks.md');
    const outputPath = join(tempDir, 'report.md');
    await fsWriteFile(configTasksPath, VALID_TASKS_CONTENT, 'utf-8');
    await fsWriteFile(cliTasksPath, VALID_TASKS_CONTENT, 'utf-8');

    const configPath = join(tempDir, '.coworkrc.json');
    await fsWriteFile(configPath, JSON.stringify({
      tasksPath: configTasksPath,
      outputPath: join(tempDir, 'config-report.md'),
    }), 'utf-8');

    // CLI flag --tasks and --output should override config
    await run(makeOptions({ configPath, tasksPath: cliTasksPath, outputPath }));

    const reportContent = await fsReadFile(outputPath, 'utf-8');
    expect(reportContent).toContain('Overnight Session Report');

    // The config-report.md should NOT have been written
    let configReportExists = true;
    try {
      await fsReadFile(join(tempDir, 'config-report.md'), 'utf-8');
    } catch {
      configReportExists = false;
    }
    expect(configReportExists).toBe(false);
  });
});

describe('formatSummary', () => {
  it('formats completed/failed/skipped counts and elapsed time', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T00:02:30Z');
    const result = {
      completed: [{ title: 'A', priority: 'high' as const, type: 'code' as const, context: '', status: 'completed' as const }],
      failed: [{ title: 'B', priority: 'medium' as const, type: 'code' as const, context: '', status: 'failed' as const }],
      skipped: [],
      startTime: start,
      endTime: end,
    };
    expect(formatSummary(result)).toBe('Summary: 1 completed, 1 failed, 0 skipped (2m 30s)');
  });

  it('shows seconds only when under a minute', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T00:00:45Z');
    const result = {
      completed: [],
      failed: [],
      skipped: [],
      startTime: start,
      endTime: end,
    };
    expect(formatSummary(result)).toBe('Summary: 0 completed, 0 failed, 0 skipped (45s)');
  });
});
