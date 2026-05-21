import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateJsonReport } from './reporter.js';
import { SessionResult } from './types.js';

export async function saveSessionLog(
  logDir: string,
  result: SessionResult,
  commits: string[],
): Promise<string> {
  await mkdir(logDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const fileName = `${timestamp}.json`;
  const filePath = join(logDir, fileName);

  const jsonContent = generateJsonReport(result, commits);
  await writeFile(filePath, jsonContent, 'utf-8');

  return filePath;
}

export async function listSessionLogs(logDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(logDir);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }

  const jsonFiles = entries
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .map((name) => join(logDir, name));

  return jsonFiles;
}

export async function loadSessionLog(filePath: string): Promise<object> {
  const content = await readFile(filePath, 'utf-8');

  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`Invalid log file: expected a JSON object in '${filePath}'`);
    }
    return parsed as object;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Corrupt log file '${filePath}': invalid JSON — ${error.message}`,
      );
    }
    throw error;
  }
}
