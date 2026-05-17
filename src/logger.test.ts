import { describe, it, expect } from 'vitest';
import { createLogger, LogEntry } from './logger.js';

describe('createLogger', () => {
  describe('basic logging at each level', () => {
    it('logs debug messages', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.debug('debug message');

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('debug');
      expect(entries[0].message).toBe('debug message');
    });

    it('logs info messages', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.info('info message');

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('info message');
    });

    it('logs warn messages', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.warn('warn message');

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('warn');
      expect(entries[0].message).toBe('warn message');
    });

    it('logs error messages', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.error('error message');

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('error message');
    });
  });

  describe('level filtering', () => {
    it('filters out debug when level is info', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'info', write: (entry) => entries.push(entry) });

      logger.debug('should be filtered');
      logger.info('should pass');

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('should pass');
    });

    it('filters out debug and info when level is warn', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'warn', write: (entry) => entries.push(entry) });

      logger.debug('filtered');
      logger.info('filtered');
      logger.warn('passes');
      logger.error('passes');

      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('only allows error when level is error', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'error', write: (entry) => entries.push(entry) });

      logger.debug('filtered');
      logger.info('filtered');
      logger.warn('filtered');
      logger.error('passes');

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
    });
  });

  describe('default level', () => {
    it('defaults to info level', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ write: (entry) => entries.push(entry) });

      logger.debug('filtered');
      logger.info('passes');
      logger.warn('passes');
      logger.error('passes');

      expect(entries).toHaveLength(3);
      expect(entries[0].level).toBe('info');
      expect(entries[1].level).toBe('warn');
      expect(entries[2].level).toBe('error');
    });
  });

  describe('custom writer', () => {
    it('calls custom write function with the entry', () => {
      const entries: LogEntry[] = [];
      const writer = (entry: LogEntry) => entries.push(entry);
      const logger = createLogger({ level: 'debug', write: writer });

      logger.info('test', { key: 'value' });

      expect(entries).toHaveLength(1);
      expect(entries[0].data).toEqual({ key: 'value' });
    });

    it('does not require data field', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.info('no data');

      expect(entries[0].data).toBeUndefined();
    });
  });

  describe('entry format', () => {
    it('includes ISO 8601 timestamp', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ write: (entry) => entries.push(entry) });

      logger.info('test');

      const timestamp = entries[0].timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Ensure it can be parsed as a valid date
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('includes level, message, and data in the entry', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.warn('something happened', { count: 42 });

      const entry = entries[0];
      expect(entry).toEqual({
        timestamp: expect.any(String),
        level: 'warn',
        message: 'something happened',
        data: { count: 42 },
      });
    });

    it('omits data field when not provided', () => {
      const entries: LogEntry[] = [];
      const logger = createLogger({ level: 'debug', write: (entry) => entries.push(entry) });

      logger.info('clean entry');

      expect(Object.keys(entries[0])).toEqual(['timestamp', 'level', 'message']);
    });
  });
});
