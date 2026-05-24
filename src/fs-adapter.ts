import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function readFileContent(filePath: string): string {
  if (!filePath || filePath.trim() === '') {
    throw new Error('filePath must not be empty');
  }
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

export function writeFileContent(filePath: string, content: string): void {
  if (!filePath || filePath.trim() === '') {
    throw new Error('filePath must not be empty');
  }
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  if (!filePath || filePath.trim() === '') {
    throw new Error('filePath must not be empty');
  }
  return existsSync(filePath);
}
