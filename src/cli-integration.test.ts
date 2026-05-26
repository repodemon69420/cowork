import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, CliOptions } from './cli.js';
import { fileExists } from './io.js';

let tempDir: string;
let stdoutOutput: string;
let stderrOutput: string;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cowork-cli-integ-'));
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
  vi.restoreAllMocks();
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

function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit');
  }) as never);
}

async function writeTasks(filename: string, content: string): Promise<string> {
  const filePath = join(tempDir, filename);
  await fsWriteFile(filePath, content, 'utf-8');
  return filePath;
}

describe('CLI integration tests', () => {
  it('valid task file — dry-run shows execution plan with batches', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

> Add tasks below...

---

## [ ] Build the API
**Priority:** high
**Type:** code
**Context:** Create a REST API

---

## [ ] Set up monitoring
**Priority:** medium
**Type:** code
**Context:** Add health checks and alerting

---

## [ ] Write docs
**Priority:** low
**Type:** docs
**Context:** Document the API
**Depends on:** Build the API

---
`);

    await run(makeOptions({ dryRun: true, tasksPath }));

    expect(stdoutOutput).toContain('Execution Plan');
    expect(stdoutOutput).toContain('==============');
    // Batch 1 should contain the two independent tasks
    expect(stdoutOutput).toContain('Batch 1');
    expect(stdoutOutput).toContain('Build the API');
    expect(stdoutOutput).toContain('Set up monitoring');
    // Batch 2 should contain the dependent task
    expect(stdoutOutput).toContain('Batch 2');
    expect(stdoutOutput).toContain('Write docs');
  });

  it('valid task file — full run writes report', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [ ] Implement auth
**Priority:** high
**Type:** code
**Context:** Add JWT authentication

---

## [ ] Add rate limiting
**Priority:** medium
**Type:** code
**Context:** Prevent abuse

---
`);

    const outputPath = join(tempDir, 'report.md');
    await run(makeOptions({ tasksPath, outputPath }));

    const exists = await fileExists(outputPath);
    expect(exists).toBe(true);

    const report = await fsReadFile(outputPath, 'utf-8');
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('**Duration**');
    expect(report).toContain('**Tasks**');
    // Both tasks should now be completed (executor runs them)
    expect(report).toContain('Implement auth');
    expect(report).toContain('Add rate limiting');

    // Verify TASKS.md was updated with completed statuses
    const updatedTasks = await fsReadFile(tasksPath, 'utf-8');
    expect(updatedTasks).toContain('[x] Implement auth');
    expect(updatedTasks).toContain('[x] Add rate limiting');
    expect(updatedTasks).not.toContain('[ ] Implement auth');
    expect(updatedTasks).not.toContain('[ ] Add rate limiting');
  });

  it('validate mode — valid tasks pass', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [ ] Research caching
**Priority:** high
**Type:** research
**Context:** Evaluate Redis vs Memcached

---

## [ ] Implement caching
**Priority:** medium
**Type:** code
**Context:** Add caching layer
**Depends on:** Research caching

---
`);

    await run(makeOptions({ validate: true, tasksPath }));

    expect(stdoutOutput).toContain('Validation passed');
    expect(stdoutOutput).toContain('2 tasks');
    expect(stderrOutput).toBe('');
  });

  it('validate mode — detects duplicate titles', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [ ] Build the API
**Priority:** high
**Type:** code
**Context:** First version

---

## [ ] Build the API
**Priority:** medium
**Type:** code
**Context:** Second version with same title

---
`);

    const exitSpy = mockProcessExit();

    try {
      await run(makeOptions({ validate: true, tasksPath }));
    } catch {
      // expected from mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrOutput).toContain('Duplicate');
  });

  it('validate mode — detects missing dependency', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [ ] Deploy to production
**Priority:** high
**Type:** code
**Context:** Ship it
**Depends on:** Run integration tests

---
`);

    const exitSpy = mockProcessExit();

    try {
      await run(makeOptions({ validate: true, tasksPath }));
    } catch {
      // expected from mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrOutput).toContain('does not match any existing task');
  });

  it('missing tasks file — shows error', async () => {
    const exitSpy = mockProcessExit();

    try {
      await run(makeOptions({ tasksPath: '/tmp/does-not-exist-abc123.md' }));
    } catch {
      // expected from mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrOutput).toContain('File not found');
  });

  it('empty task file — dry-run shows no batches', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

> No tasks yet.

---
`);

    await run(makeOptions({ dryRun: true, tasksPath }));

    expect(stdoutOutput).toContain('Execution Plan');
    expect(stdoutOutput).toContain('==============');
    // No batch entries since there are no tasks
    expect(stdoutOutput).not.toContain('Batch');
  });

  it('full pipeline round-trip: validate, dry-run, then full run', async () => {
    const tasksContent = `# Nightly Task Queue

---

## [ ] Design database schema
**Priority:** high
**Type:** design
**Context:** Model user accounts and permissions

---

## [ ] Implement ORM models
**Priority:** medium
**Type:** code
**Context:** Create TypeORM entities
**Depends on:** Design database schema

---

## [ ] Write migration scripts
**Priority:** low
**Type:** code
**Context:** Handle schema changes
**Depends on:** Implement ORM models

---
`;

    const tasksPath = await writeTasks('TASKS.md', tasksContent);
    const outputPath = join(tempDir, 'MORNING_REPORT.md');

    // Step 1: validate — should pass
    await run(makeOptions({ validate: true, tasksPath }));
    expect(stdoutOutput).toContain('Validation passed');
    expect(stdoutOutput).toContain('3 tasks');

    // Reset captured output
    stdoutOutput = '';
    stderrOutput = '';

    // Step 2: dry-run — see the plan
    await run(makeOptions({ dryRun: true, tasksPath }));
    expect(stdoutOutput).toContain('Execution Plan');
    expect(stdoutOutput).toContain('Design database schema');
    expect(stdoutOutput).toContain('Implement ORM models');
    expect(stdoutOutput).toContain('Write migration scripts');

    // Reset captured output
    stdoutOutput = '';
    stderrOutput = '';

    // Step 3: full run — write report
    await run(makeOptions({ tasksPath, outputPath }));
    expect(stdoutOutput).toContain('Report written to');

    // Step 4: read and verify the report
    const report = await fsReadFile(outputPath, 'utf-8');
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('Design database schema');
    expect(report).toContain('Implement ORM models');
    expect(report).toContain('Write migration scripts');

    // Step 5: verify TASKS.md was updated — all tasks marked completed
    const updatedTasks = await fsReadFile(tasksPath, 'utf-8');
    expect(updatedTasks).toContain('[x] Design database schema');
    expect(updatedTasks).toContain('[x] Implement ORM models');
    expect(updatedTasks).toContain('[x] Write migration scripts');
    expect(updatedTasks).not.toContain('[ ] Design database schema');
    expect(updatedTasks).not.toContain('[ ] Implement ORM models');
    expect(updatedTasks).not.toContain('[ ] Write migration scripts');
  });

  it('mixed completed and pending tasks — dry-run shows only pending', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [x] Set up CI pipeline
**Priority:** high
**Type:** code
**Context:** GitHub Actions workflow

---

## [x] Configure linting
**Priority:** medium
**Type:** code
**Context:** ESLint and Prettier

---

## [ ] Add test coverage
**Priority:** high
**Type:** test
**Context:** Reach 80% coverage

---

## [ ] Deploy staging
**Priority:** low
**Type:** code
**Context:** Push to staging environment
**Depends on:** Add test coverage

---
`);

    await run(makeOptions({ dryRun: true, tasksPath }));

    expect(stdoutOutput).toContain('Execution Plan');
    // Only pending tasks should appear in the plan
    expect(stdoutOutput).toContain('Add test coverage');
    expect(stdoutOutput).toContain('Deploy staging');
    // Completed tasks should NOT appear in the plan
    expect(stdoutOutput).not.toContain('Set up CI pipeline');
    expect(stdoutOutput).not.toContain('Configure linting');
  });

  it('tasks with unicode content — full run preserves unicode in report', async () => {
    const tasksPath = await writeTasks('TASKS.md', `# Nightly Task Queue

---

## [ ] Déployer l'application \u{1F680}
**Priority:** high
**Type:** code
**Context:** Mise en production avec vérification \u{2705}

---

## [ ] 数据库优化 \u{1F4CA}
**Priority:** medium
**Type:** code
**Context:** 提高查询性能，添加索引 \u{26A1}

---

## [ ] Tëst spëcîal chàräctérs
**Priority:** low
**Type:** test
**Context:** Ñoño café über straße — em-dash • bullet ★ star

---
`);

    const outputPath = join(tempDir, 'unicode-report.md');
    await run(makeOptions({ tasksPath, outputPath }));

    const report = await fsReadFile(outputPath, 'utf-8');
    expect(report).toContain('# Overnight Session Report');
    expect(report).toContain('Déployer l\'application \u{1F680}');
    expect(report).toContain('Mise en production avec vérification \u{2705}');
    expect(report).toContain('数据库优化 \u{1F4CA}');
    expect(report).toContain('提高查询性能，添加索引 \u{26A1}');
    expect(report).toContain('Tëst spëcîal chàräctérs');
    expect(report).toContain('Ñoño café über straße — em-dash • bullet ★ star');
  });
});
