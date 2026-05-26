import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function getCurrentBranch(cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
  return stdout.trim();
}

export async function createBranch(name: string, cwd?: string): Promise<void> {
  await execFileAsync('git', ['checkout', '-b', name], { cwd });
}

export async function commitAll(message: string, cwd?: string): Promise<string> {
  await execFileAsync('git', ['add', '-A'], { cwd });
  await execFileAsync('git', ['commit', '-m', message], { cwd });
  const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd });
  return stdout.trim();
}

export async function getRecentCommits(count: number, cwd?: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['log', `--max-count=${count}`, '--oneline'], { cwd });
  return stdout.trim().split('\n').filter(Boolean);
}

export async function hasUncommittedChanges(cwd?: string): Promise<boolean> {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
  return stdout.trim().length > 0;
}
