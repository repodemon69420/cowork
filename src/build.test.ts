import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('TypeScript build', () => {
  it('compiles without errors using tsconfig.build.json', () => {
    const result = execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json', '--noEmit'], {
      cwd: join(import.meta.dirname, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // If execFileSync doesn't throw, exit code was 0
    expect(result).toBeDefined();
  });

  it('does not include test files in build output', () => {
    // Run a fresh build
    execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], {
      cwd: join(import.meta.dirname, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const distDir = join(import.meta.dirname, '..', 'dist');
    const files = readdirSync(distDir);
    const testFiles = files.filter(f => f.includes('.test.'));
    expect(testFiles).toEqual([]);
  });
});
