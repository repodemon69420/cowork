import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  let stdoutWrite: MockInstance;
  let stderrWrite: MockInstance;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('info level logs info messages to stdout', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('hello');
    expect(stdoutWrite).toHaveBeenCalledWith('[INFO] hello\n');
  });

  it('info level does NOT log debug messages', () => {
    const logger = createLogger({ level: 'info' });
    logger.debug('hidden');
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it('warn level logs to stderr', () => {
    const logger = createLogger({ level: 'info' });
    logger.warn('caution');
    expect(stderrWrite).toHaveBeenCalledWith('[WARN] caution\n');
  });

  it('error level logs to stderr', () => {
    const logger = createLogger({ level: 'info' });
    logger.error('failure');
    expect(stderrWrite).toHaveBeenCalledWith('[ERROR] failure\n');
  });

  it('debug level logs all levels', () => {
    const logger = createLogger({ level: 'debug' });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(stdoutWrite).toHaveBeenCalledWith('[DEBUG] d\n');
    expect(stdoutWrite).toHaveBeenCalledWith('[INFO] i\n');
    expect(stderrWrite).toHaveBeenCalledWith('[WARN] w\n');
    expect(stderrWrite).toHaveBeenCalledWith('[ERROR] e\n');
  });

  it('data object is JSON-stringified in output', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('with data', { key: 'value', count: 42 });
    expect(stdoutWrite).toHaveBeenCalledWith(
      '[INFO] with data {"key":"value","count":42}\n',
    );
  });

  it('quiet mode suppresses all except error', () => {
    const logger = createLogger({ level: 'debug', quiet: true });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it('message format: "[LEVEL] message"', () => {
    const logger = createLogger({ level: 'debug' });
    logger.debug('test message');
    expect(stdoutWrite).toHaveBeenCalledWith('[DEBUG] test message\n');
    logger.info('test message');
    expect(stdoutWrite).toHaveBeenCalledWith('[INFO] test message\n');
    logger.warn('test message');
    expect(stderrWrite).toHaveBeenCalledWith('[WARN] test message\n');
    logger.error('test message');
    expect(stderrWrite).toHaveBeenCalledWith('[ERROR] test message\n');
  });

  it('message format with data: "[LEVEL] message {json}"', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('hello', { foo: 'bar' });
    expect(stdoutWrite).toHaveBeenCalledWith('[INFO] hello {"foo":"bar"}\n');
    logger.error('fail', { code: 1 });
    expect(stderrWrite).toHaveBeenCalledWith('[ERROR] fail {"code":1}\n');
  });

  it('error in quiet mode still outputs', () => {
    const logger = createLogger({ level: 'debug', quiet: true });
    logger.error('critical');
    expect(stderrWrite).toHaveBeenCalledWith('[ERROR] critical\n');
  });
});
