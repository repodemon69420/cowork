import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, run, CliOptions } from './cli.js';

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
    });
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
      ...overrides,
    };
  }

  it('help mode prints usage', async () => {
    await run(makeOptions({ help: true }));
    expect(stdoutOutput).toContain('--tasks');
    expect(stdoutOutput).toContain('--output');
    expect(stdoutOutput).toContain('--dry-run');
    expect(stdoutOutput).toContain('--validate');
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
});
