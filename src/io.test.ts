import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, fileExists } from './io.js';

describe('io', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-io-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads an existing file correctly', async () => {
      const filePath = join(tempDir, 'hello.txt');
      await fsWriteFile(filePath, 'Hello, world!', 'utf-8');

      const content = await readFile(filePath);
      expect(content).toBe('Hello, world!');
    });

    it('throws on non-existent file with descriptive message', async () => {
      const filePath = join(tempDir, 'missing.txt');

      await expect(readFile(filePath)).rejects.toThrow(/missing\.txt/);
    });
  });

  describe('writeFile', () => {
    it('creates a new file', async () => {
      const filePath = join(tempDir, 'new-file.txt');

      await writeFile(filePath, 'new content');

      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('overwrites an existing file', async () => {
      const filePath = join(tempDir, 'overwrite.txt');
      await fsWriteFile(filePath, 'original', 'utf-8');

      await writeFile(filePath, 'replaced');

      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('replaced');
    });

    it('creates parent directories if they do not exist', async () => {
      const filePath = join(tempDir, 'a', 'b', 'c', 'deep.txt');

      await writeFile(filePath, 'deep content');

      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('deep content');
    });
  });

  describe('fileExists', () => {
    it('returns true for existing file', async () => {
      const filePath = join(tempDir, 'exists.txt');
      await fsWriteFile(filePath, 'data', 'utf-8');

      const result = await fileExists(filePath);
      expect(result).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      const filePath = join(tempDir, 'nope.txt');

      const result = await fileExists(filePath);
      expect(result).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('readFile -> writeFile round-trip preserves content', async () => {
      const sourcePath = join(tempDir, 'source.txt');
      const destPath = join(tempDir, 'dest.txt');
      const original = 'Line 1\nLine 2\nLine 3\n';

      await fsWriteFile(sourcePath, original, 'utf-8');

      const content = await readFile(sourcePath);
      await writeFile(destPath, content);

      const result = await fsReadFile(destPath, 'utf-8');
      expect(result).toBe(original);
    });
  });

  describe('UTF-8 content', () => {
    it('handles emoji and unicode characters', async () => {
      const filePath = join(tempDir, 'unicode.txt');
      const content = '🚀 Hello 世界! Ñoño café ✨ 日本語テスト';

      await writeFile(filePath, content);
      const result = await readFile(filePath);

      expect(result).toBe(content);
    });
  });
});
