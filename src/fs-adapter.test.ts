import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, fileExists } from './fs-adapter.js';
import { mkdtemp, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('fs-adapter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fs-adapter-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads content from an existing file', async () => {
      const filePath = join(tempDir, 'test.md');
      await fsWriteFile(filePath, 'Hello, world!', 'utf-8');

      const content = await readFile(filePath);
      expect(content).toBe('Hello, world!');
    });

    it('reads multi-line content correctly', async () => {
      const filePath = join(tempDir, 'multi.md');
      const multiLine = '# Title\n\nLine 1\nLine 2\n';
      await fsWriteFile(filePath, multiLine, 'utf-8');

      const content = await readFile(filePath);
      expect(content).toBe(multiLine);
    });

    it('throws descriptive error for non-existent file', async () => {
      const filePath = join(tempDir, 'does-not-exist.md');

      await expect(readFile(filePath)).rejects.toThrow(`File not found: ${filePath}`);
    });

    it('propagates other errors naturally', async () => {
      // Reading a directory should throw a non-ENOENT, non-EACCES error
      await expect(readFile(tempDir)).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('writes content to a new file', async () => {
      const filePath = join(tempDir, 'output.md');

      await writeFile(filePath, 'Report content');

      const { readFile: nodeReadFile } = await import('node:fs/promises');
      const content = await nodeReadFile(filePath, 'utf-8');
      expect(content).toBe('Report content');
    });

    it('overwrites existing file content', async () => {
      const filePath = join(tempDir, 'overwrite.md');
      await fsWriteFile(filePath, 'old content', 'utf-8');

      await writeFile(filePath, 'new content');

      const { readFile: nodeReadFile } = await import('node:fs/promises');
      const content = await nodeReadFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('creates parent directories if they do not exist', async () => {
      const filePath = join(tempDir, 'nested', 'deep', 'dir', 'report.md');

      await writeFile(filePath, 'nested report');

      const { readFile: nodeReadFile } = await import('node:fs/promises');
      const content = await nodeReadFile(filePath, 'utf-8');
      expect(content).toBe('nested report');
    });

  });

  describe('fileExists', () => {
    it('returns true for an existing file', async () => {
      const filePath = join(tempDir, 'exists.md');
      await fsWriteFile(filePath, 'content', 'utf-8');

      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('returns false for a non-existent file', async () => {
      const filePath = join(tempDir, 'ghost.md');

      const exists = await fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('returns true for a directory', async () => {
      const exists = await fileExists(tempDir);
      expect(exists).toBe(true);
    });
  });
});
