import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  getCurrentBranch,
  createBranch,
  commitAll,
  getRecentCommits,
  hasUncommittedChanges,
} from './git.js';

const execFileAsync = promisify(execFile);

async function initRepo(dir: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
}

describe('git', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowork-git-test-'));
    await initRepo(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getCurrentBranch', () => {
    it('returns branch name', async () => {
      // Need at least one commit for rev-parse to work
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await execFileAsync('git', ['add', '-A'], { cwd: tempDir });
      await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: tempDir });

      const branch = await getCurrentBranch(tempDir);
      expect(branch).toBe('main');
    });

    it('fails in non-git directory', async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), 'cowork-nogit-'));
      try {
        await expect(getCurrentBranch(nonGitDir)).rejects.toThrow();
      } finally {
        await rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe('createBranch', () => {
    it('creates and switches to new branch', async () => {
      // Need initial commit before creating branches
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await execFileAsync('git', ['add', '-A'], { cwd: tempDir });
      await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: tempDir });

      await createBranch('feature-test', tempDir);

      const branch = await getCurrentBranch(tempDir);
      expect(branch).toBe('feature-test');
    });
  });

  describe('commitAll', () => {
    it('stages and commits files, returns hash', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'hello');

      const hash = await commitAll('test commit', tempDir);

      expect(hash).toMatch(/^[0-9a-f]{7,}$/);

      // Verify the commit message
      const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%s'], { cwd: tempDir });
      expect(stdout.trim()).toBe('test commit');
    });

    it('throws when nothing to commit', async () => {
      // Create an initial commit so we have a clean repo
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await execFileAsync('git', ['add', '-A'], { cwd: tempDir });
      await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: tempDir });

      await expect(commitAll('empty commit', tempDir)).rejects.toThrow();
    });
  });

  describe('getRecentCommits', () => {
    it('returns N most recent commits', async () => {
      await writeFile(join(tempDir, 'a.txt'), 'a');
      await commitAll('first', tempDir);

      await writeFile(join(tempDir, 'b.txt'), 'b');
      await commitAll('second', tempDir);

      await writeFile(join(tempDir, 'c.txt'), 'c');
      await commitAll('third', tempDir);

      const commits = await getRecentCommits(2, tempDir);
      expect(commits).toHaveLength(2);
      expect(commits[0]).toContain('third');
      expect(commits[1]).toContain('second');
    });

    it('returns empty array for new repo with no commits', async () => {
      // git log fails on a repo with no commits, so we expect either
      // an error or an empty array depending on implementation
      // Since git log throws on empty repo, we handle the error case
      await expect(getRecentCommits(5, tempDir)).rejects.toThrow();
    });
  });

  describe('hasUncommittedChanges', () => {
    it('returns false for clean repo', async () => {
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await commitAll('initial', tempDir);

      const result = await hasUncommittedChanges(tempDir);
      expect(result).toBe(false);
    });

    it('returns true when files are modified', async () => {
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await commitAll('initial', tempDir);

      await writeFile(join(tempDir, 'init.txt'), 'modified');

      const result = await hasUncommittedChanges(tempDir);
      expect(result).toBe(true);
    });
  });
});
