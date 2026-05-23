import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
}));

vi.mock('node:fs/promises', () => mocks);

import { readFile, writeFile } from './fs-adapter.js';

function makeErrnoError(code: string): NodeJS.ErrnoException {
  const err = new Error(`${code}: operation not permitted`) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe('fs-adapter error handling (mocked)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.mkdir.mockResolvedValue(undefined);
  });

  describe('readFile', () => {
    it('throws "Permission denied" for EACCES errors', async () => {
      mocks.readFile.mockRejectedValueOnce(makeErrnoError('EACCES'));

      await expect(readFile('/some/path.md')).rejects.toThrow('Permission denied: /some/path.md');
    });

    it('throws "File not found" for ENOENT errors', async () => {
      mocks.readFile.mockRejectedValueOnce(makeErrnoError('ENOENT'));

      await expect(readFile('/missing.md')).rejects.toThrow('File not found: /missing.md');
    });

    it('re-throws non-errno errors', async () => {
      mocks.readFile.mockRejectedValueOnce(new Error('something else'));

      await expect(readFile('/some/path.md')).rejects.toThrow('something else');
    });
  });

  describe('writeFile', () => {
    it('throws "Permission denied" for EACCES errors', async () => {
      mocks.writeFile.mockRejectedValueOnce(makeErrnoError('EACCES'));

      await expect(writeFile('/locked/path.md', 'content')).rejects.toThrow('Permission denied: /locked/path.md');
    });

    it('re-throws non-errno errors from writeFile', async () => {
      mocks.writeFile.mockRejectedValueOnce(new Error('disk full'));

      await expect(writeFile('/some/path.md', 'content')).rejects.toThrow('disk full');
    });

    it('re-throws EACCES from mkdir', async () => {
      mocks.mkdir.mockRejectedValueOnce(makeErrnoError('EACCES'));

      await expect(writeFile('/locked/dir/path.md', 'content')).rejects.toThrow('Permission denied:');
    });
  });
});
