import { execSync } from 'node:child_process';

export function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('Failed to get current branch. Are you in a git repository?');
  }
}

export function getLatestCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('Failed to get latest commit hash. Are you in a git repository?');
  }
}

export function getCommitsSince(ref: string): string[] {
  if (!ref) {
    throw new Error('ref parameter must not be empty');
  }
  try {
    const output = execSync(`git log --oneline ${ref}..HEAD`, { encoding: 'utf-8' }).trim();
    return output === '' ? [] : output.split('\n');
  } catch {
    throw new Error(`Failed to get commits since "${ref}". Is the ref valid?`);
  }
}

export function hasStagedChanges(): boolean {
  try {
    execSync('git diff --cached --quiet', { encoding: 'utf-8' });
    return false;
  } catch {
    return true;
  }
}

export function hasUncommittedChanges(): boolean {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    return output !== '';
  } catch {
    throw new Error('Failed to check uncommitted changes. Are you in a git repository?');
  }
}
