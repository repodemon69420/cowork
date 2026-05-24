import { describe, it, expect } from 'vitest';
import {
  getCurrentBranch,
  getLatestCommitHash,
  getCommitsSince,
  hasStagedChanges,
  hasUncommittedChanges,
} from './git-adapter.js';

describe('git-adapter', () => {
  it('getCurrentBranch returns a non-empty string', () => {
    const branch = getCurrentBranch();
    expect(branch).toBeTruthy();
    expect(typeof branch).toBe('string');
  });

  it('getLatestCommitHash returns a short hash', () => {
    const hash = getLatestCommitHash();
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('getCommitsSince with HEAD~1 returns at least one entry', () => {
    const commits = getCommitsSince('HEAD~1');
    expect(commits.length).toBeGreaterThanOrEqual(1);
  });

  it('getCommitsSince with empty ref throws', () => {
    expect(() => getCommitsSince('')).toThrow('ref parameter must not be empty');
  });

  it('hasUncommittedChanges returns a boolean', () => {
    const result = hasUncommittedChanges();
    expect(typeof result).toBe('boolean');
  });

  it('hasStagedChanges returns a boolean', () => {
    const result = hasStagedChanges();
    expect(typeof result).toBe('boolean');
  });

  it('getCommitsSince with invalid ref throws descriptive error', () => {
    expect(() => getCommitsSince('nonexistent-ref-abc123xyz')).toThrow('Failed to get commits since');
  });

  it('getCommitsSince with HEAD..HEAD returns empty array', () => {
    const commits = getCommitsSince('HEAD');
    expect(commits).toEqual([]);
  });
});
