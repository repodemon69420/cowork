import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveSessionLog, listSessionLogs, loadSessionLog } from './history.js';
import { SessionResult, Task } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Default task',
    priority: 'medium',
    type: 'code',
    context: '',
    status: 'pending',
    ...overrides,
  };
}

function makeResult(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    completed: [],
    failed: [],
    skipped: [],
    startTime: new Date('2026-01-15T22:00:00Z'),
    endTime: new Date('2026-01-15T23:30:00Z'),
    ...overrides,
  };
}

describe('saveSessionLog', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-history-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates log directory if missing', async () => {
    const logDir = join(tempDir, 'nested', 'logs');
    const result = makeResult({
      completed: [makeTask({ title: 'Task A', status: 'completed' })],
    });

    const filePath = await saveSessionLog(logDir, result, []);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBeTruthy();
    expect(filePath.startsWith(logDir)).toBe(true);
  });

  it('writes valid JSON that can be parsed back', async () => {
    const logDir = join(tempDir, 'logs');
    const result = makeResult({
      completed: [makeTask({ title: 'Task A', status: 'completed' })],
      failed: [makeTask({ title: 'Task B', status: 'failed' })],
    });

    const filePath = await saveSessionLog(logDir, result, ['abc123 commit']);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.completed).toBe(1);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.commits).toEqual(['abc123 commit']);
  });

  it('file names contain valid ISO-like timestamps', async () => {
    const logDir = join(tempDir, 'logs');
    const result = makeResult();

    const filePath = await saveSessionLog(logDir, result, []);
    const fileName = filePath.split('/').pop()!;

    // Should end with .json
    expect(fileName.endsWith('.json')).toBe(true);

    // Should contain ISO-like timestamp pattern (colons replaced with dashes)
    const nameWithoutExt = fileName.replace('.json', '');
    // ISO timestamp pattern: YYYY-MM-DDTHH-MM-SS.sssZ
    expect(nameWithoutExt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/,
    );
  });
});

describe('listSessionLogs', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-history-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns files in reverse chronological order', async () => {
    const logDir = join(tempDir, 'logs');
    await mkdir(logDir, { recursive: true });

    await writeFile(join(logDir, '2026-01-10T10-00-00.000Z.json'), '{}');
    await writeFile(join(logDir, '2026-01-12T10-00-00.000Z.json'), '{}');
    await writeFile(join(logDir, '2026-01-11T10-00-00.000Z.json'), '{}');

    const logs = await listSessionLogs(logDir);

    expect(logs).toHaveLength(3);
    expect(logs[0]).toContain('2026-01-12');
    expect(logs[1]).toContain('2026-01-11');
    expect(logs[2]).toContain('2026-01-10');
  });

  it('returns empty array for empty directory', async () => {
    const logDir = join(tempDir, 'empty-logs');
    await mkdir(logDir, { recursive: true });

    const logs = await listSessionLogs(logDir);
    expect(logs).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const logDir = join(tempDir, 'does-not-exist');

    const logs = await listSessionLogs(logDir);
    expect(logs).toEqual([]);
  });

  it('only includes .json files', async () => {
    const logDir = join(tempDir, 'logs');
    await mkdir(logDir, { recursive: true });

    await writeFile(join(logDir, '2026-01-10T10-00-00.000Z.json'), '{}');
    await writeFile(join(logDir, '2026-01-11T10-00-00.000Z.txt'), 'not json');
    await writeFile(join(logDir, 'readme.md'), '# readme');

    const logs = await listSessionLogs(logDir);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('2026-01-10');
  });
});

describe('loadSessionLog', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-history-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('round-trip: save then load returns matching data', async () => {
    const logDir = join(tempDir, 'logs');
    const result = makeResult({
      completed: [makeTask({ title: 'Task X', status: 'completed' })],
      failed: [makeTask({ title: 'Task Y', status: 'failed' })],
      skipped: [makeTask({ title: 'Task Z', status: 'skipped' })],
    });
    const commits = ['abc1234 First commit', 'def5678 Second commit'];

    const filePath = await saveSessionLog(logDir, result, commits);
    const loaded = await loadSessionLog(filePath);

    const expected = JSON.parse(
      await readFile(filePath, 'utf-8'),
    );
    expect(loaded).toEqual(expected);
  });

  it('throws on corrupt JSON', async () => {
    const filePath = join(tempDir, 'corrupt.json');
    await writeFile(filePath, '{invalid json content!!!', 'utf-8');

    await expect(loadSessionLog(filePath)).rejects.toThrow(/Corrupt log file/);
  });
});
