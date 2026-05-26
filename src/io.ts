import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Reads a UTF-8 file at the given path.
 * Throws a descriptive error if the file is not found.
 */
export async function readFile(path: string): Promise<string> {
  try {
    return await fsReadFile(path, 'utf-8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw error;
  }
}

/**
 * Writes content to a file at the given path.
 * Creates parent directories if they don't exist.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await fsWriteFile(path, content, 'utf-8');
}

/**
 * Returns true if the file exists and is accessible, false otherwise.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
