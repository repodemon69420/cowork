import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir,
  access,
} from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fsReadFile(filePath, 'utf-8');
  } catch (error: unknown) {
    if (isNodeError(error)) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
    }
    throw error;
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await fsWriteFile(filePath, content, 'utf-8');
  } catch (error: unknown) {
    if (isNodeError(error)) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
    }
    throw error;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
