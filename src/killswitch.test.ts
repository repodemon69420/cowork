import { describe, it, expect } from 'vitest';
import { checkKillSwitch } from './killswitch.js';

describe('checkKillSwitch', () => {
  it('"ON" status returns active: true', () => {
    const result = checkKillSwitch('# Status: ON\n');
    expect(result.active).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('"OFF" status returns active: false with reason', () => {
    const result = checkKillSwitch('# Status: OFF\n');
    expect(result.active).toBe(false);
    expect(result.reason).toBe('Status set to OFF');
  });

  it('"off" (lowercase) returns active: false', () => {
    const result = checkKillSwitch('# Status: off\n');
    expect(result.active).toBe(false);
    expect(result.reason).toBe('Status set to OFF');
  });

  it('"On" (mixed case) returns active: true', () => {
    const result = checkKillSwitch('# Status: On\n');
    expect(result.active).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('missing status line returns active: true', () => {
    const result = checkKillSwitch('Some other content\nNo status here\n');
    expect(result.active).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('empty content returns active: true', () => {
    const result = checkKillSwitch('');
    expect(result.active).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('status line with extra whitespace works', () => {
    const result = checkKillSwitch('# Status:   OFF   \n');
    expect(result.active).toBe(false);
    expect(result.reason).toBe('Status set to OFF');
  });

  it('content with other lines before/after status line', () => {
    const content = [
      '# My Project',
      '',
      '# Status: ON',
      '',
      '## Tasks',
      '- Task 1',
    ].join('\n');
    const result = checkKillSwitch(content);
    expect(result.active).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
