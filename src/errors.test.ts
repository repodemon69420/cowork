import { describe, it, expect } from 'vitest';
import {
  CoworkError,
  FileNotFoundError,
  TaskValidationError,
  ExecutionError,
  ConfigError,
} from './errors.js';

describe('errors', () => {
  describe('CoworkError', () => {
    it('has correct name, code, and message', () => {
      const err = new CoworkError('TEST_CODE', 'something went wrong');
      expect(err.name).toBe('CoworkError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('something went wrong');
    });

    it('extends Error', () => {
      const err = new CoworkError('X', 'msg');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('FileNotFoundError', () => {
    it('extends CoworkError', () => {
      const err = new FileNotFoundError('/tmp/missing.txt');
      expect(err).toBeInstanceOf(CoworkError);
    });

    it('extends Error', () => {
      const err = new FileNotFoundError('/tmp/missing.txt');
      expect(err).toBeInstanceOf(Error);
    });

    it('has correct name and code', () => {
      const err = new FileNotFoundError('/tmp/missing.txt');
      expect(err.name).toBe('FileNotFoundError');
      expect(err.code).toBe('FILE_NOT_FOUND');
    });

    it('has path property', () => {
      const err = new FileNotFoundError('/tmp/missing.txt');
      expect(err.path).toBe('/tmp/missing.txt');
    });

    it('includes path in message', () => {
      const err = new FileNotFoundError('/tmp/missing.txt');
      expect(err.message).toBe('File not found: /tmp/missing.txt');
    });
  });

  describe('TaskValidationError', () => {
    it('extends CoworkError', () => {
      const err = new TaskValidationError([
        { task: 'task-1', field: 'title', message: 'required' },
      ]);
      expect(err).toBeInstanceOf(CoworkError);
    });

    it('extends Error', () => {
      const err = new TaskValidationError([]);
      expect(err).toBeInstanceOf(Error);
    });

    it('has correct name and code', () => {
      const err = new TaskValidationError([]);
      expect(err.name).toBe('TaskValidationError');
      expect(err.code).toBe('VALIDATION_FAILED');
    });

    it('has errors array', () => {
      const validationErrors = [
        { task: 'task-1', field: 'title', message: 'required' },
        { task: 'task-2', field: 'priority', message: 'invalid value' },
      ];
      const err = new TaskValidationError(validationErrors);
      expect(err.errors).toEqual(validationErrors);
      expect(err.errors).toHaveLength(2);
    });

    it('includes error count in message', () => {
      const err = new TaskValidationError([
        { task: 'task-1', field: 'title', message: 'required' },
        { task: 'task-2', field: 'priority', message: 'invalid value' },
      ]);
      expect(err.message).toBe('Validation failed with 2 error(s)');
    });
  });

  describe('ExecutionError', () => {
    it('extends CoworkError', () => {
      const err = new ExecutionError('Build project', 'process exited with code 1');
      expect(err).toBeInstanceOf(CoworkError);
    });

    it('extends Error', () => {
      const err = new ExecutionError('Build project', 'process exited with code 1');
      expect(err).toBeInstanceOf(Error);
    });

    it('has correct name and code', () => {
      const err = new ExecutionError('Build project', 'process exited with code 1');
      expect(err.name).toBe('ExecutionError');
      expect(err.code).toBe('EXECUTION_FAILED');
    });

    it('has taskTitle property', () => {
      const err = new ExecutionError('Build project', 'process exited with code 1');
      expect(err.taskTitle).toBe('Build project');
    });

    it('has provided message', () => {
      const err = new ExecutionError('Build project', 'process exited with code 1');
      expect(err.message).toBe('process exited with code 1');
    });
  });

  describe('ConfigError', () => {
    it('extends CoworkError', () => {
      const err = new ConfigError('missing required field');
      expect(err).toBeInstanceOf(CoworkError);
    });

    it('extends Error', () => {
      const err = new ConfigError('missing required field');
      expect(err).toBeInstanceOf(Error);
    });

    it('has correct name and code', () => {
      const err = new ConfigError('missing required field');
      expect(err.name).toBe('ConfigError');
      expect(err.code).toBe('CONFIG_ERROR');
    });

    it('has provided message', () => {
      const err = new ConfigError('missing required field');
      expect(err.message).toBe('missing required field');
    });
  });

  describe('instanceof chains', () => {
    it('FileNotFoundError instanceof CoworkError is true', () => {
      expect(new FileNotFoundError('/x')).toBeInstanceOf(CoworkError);
    });

    it('FileNotFoundError instanceof Error is true', () => {
      expect(new FileNotFoundError('/x')).toBeInstanceOf(Error);
    });

    it('TaskValidationError instanceof CoworkError is true', () => {
      expect(new TaskValidationError([])).toBeInstanceOf(CoworkError);
    });

    it('ExecutionError instanceof CoworkError is true', () => {
      expect(new ExecutionError('t', 'm')).toBeInstanceOf(CoworkError);
    });

    it('ConfigError instanceof CoworkError is true', () => {
      expect(new ConfigError('m')).toBeInstanceOf(CoworkError);
    });

    it('CoworkError is not instanceof FileNotFoundError', () => {
      expect(new CoworkError('X', 'msg')).not.toBeInstanceOf(FileNotFoundError);
    });
  });
});
