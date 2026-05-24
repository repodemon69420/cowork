import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger } from './logger.js';
import { readFileContent } from './fs-adapter.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('Logger', () => {
  let logger: Logger;
  let tempDir: string;

  beforeEach(() => {
    logger = new Logger();
    tempDir = join(tmpdir(), `cowork-logger-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('info adds entry with [INFO] prefix', () => {
    logger.info('hello');
    const log = logger.getLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/\[INFO\] hello/);
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('warn adds entry with [WARN] prefix', () => {
    logger.warn('careful');
    const log = logger.getLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/\[WARN\] careful/);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('error adds entry with [ERROR] prefix', () => {
    logger.error('failure');
    const log = logger.getLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/\[ERROR\] failure/);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('getLog returns buffer copy', () => {
    logger.info('a');
    const copy = logger.getLog();
    copy.push('extra');
    expect(logger.getLog()).toHaveLength(1);
  });

  it('flush writes to file', () => {
    logger.info('line1');
    logger.warn('line2');
    const filePath = join(tempDir, 'log.txt');
    logger.flush(filePath);
    const content = readFileContent(filePath);
    const lines = content.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/\[INFO\] line1/);
    expect(lines[1]).toMatch(/\[WARN\] line2/);
  });

  it('multiple entries accumulate in order', () => {
    logger.info('first');
    logger.warn('second');
    logger.error('third');
    const log = logger.getLog();
    expect(log).toHaveLength(3);
    expect(log[0]).toContain('[INFO] first');
    expect(log[1]).toContain('[WARN] second');
    expect(log[2]).toContain('[ERROR] third');
  });

  it('timestamp format is ISO 8601', () => {
    logger.info('ts');
    const entry = logger.getLog()[0];
    const match = entry.match(/^\[(.+?)\]/);
    expect(match).not.toBeNull();
    const date = new Date(match![1]);
    expect(date.toISOString()).toBe(match![1]);
  });

  it('createLogger returns a Logger instance', () => {
    const l = createLogger();
    expect(l).toBeInstanceOf(Logger);
  });
});
