import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileContent, writeFileContent, fileExists } from './fs-adapter.js';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('fs-adapter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `cowork-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('readFileContent', () => {
    it('reads an existing file', () => {
      const filePath = join(tempDir, 'test.txt');
      writeFileSync(filePath, 'hello world', 'utf-8');
      expect(readFileContent(filePath)).toBe('hello world');
    });

    it('throws for a non-existent file', () => {
      const filePath = join(tempDir, 'missing.txt');
      expect(() => readFileContent(filePath)).toThrow('File not found');
    });

    it('throws for an empty path', () => {
      expect(() => readFileContent('')).toThrow('filePath must not be empty');
      expect(() => readFileContent('  ')).toThrow('filePath must not be empty');
    });
  });

  describe('writeFileContent', () => {
    it('writes content to a file', () => {
      const filePath = join(tempDir, 'output.txt');
      writeFileContent(filePath, 'written content');
      expect(readFileContent(filePath)).toBe('written content');
    });

    it('creates parent directories if needed', () => {
      const filePath = join(tempDir, 'a', 'b', 'c', 'deep.txt');
      writeFileContent(filePath, 'deep content');
      expect(readFileContent(filePath)).toBe('deep content');
    });

    it('throws for an empty path', () => {
      expect(() => writeFileContent('', 'data')).toThrow('filePath must not be empty');
      expect(() => writeFileContent('  ', 'data')).toThrow('filePath must not be empty');
    });
  });

  describe('fileExists', () => {
    it('returns true for an existing file', () => {
      const filePath = join(tempDir, 'exists.txt');
      writeFileSync(filePath, 'hi', 'utf-8');
      expect(fileExists(filePath)).toBe(true);
    });

    it('returns false for a non-existent file', () => {
      const filePath = join(tempDir, 'nope.txt');
      expect(fileExists(filePath)).toBe(false);
    });

    it('throws for an empty path', () => {
      expect(() => fileExists('')).toThrow('filePath must not be empty');
      expect(() => fileExists('  ')).toThrow('filePath must not be empty');
    });
  });
});
