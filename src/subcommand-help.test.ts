import { describe, it, expect } from 'vitest';
import { getSubcommandHelp } from './cli-handlers.js';

describe('getSubcommandHelp', () => {
  it('returns help for "run" containing --file and --execute', () => {
    const help = getSubcommandHelp('run');
    expect(help).toBeDefined();
    expect(help).toContain('--file');
    expect(help).toContain('--execute');
  });

  it('returns help for "status" containing --file', () => {
    const help = getSubcommandHelp('status');
    expect(help).toBeDefined();
    expect(help).toContain('--file');
  });

  it('returns help for "report" containing --input and --format', () => {
    const help = getSubcommandHelp('report');
    expect(help).toBeDefined();
    expect(help).toContain('--input');
    expect(help).toContain('--format');
  });

  it('returns help for "history" containing --log-dir', () => {
    const help = getSubcommandHelp('history');
    expect(help).toBeDefined();
    expect(help).toContain('--log-dir');
  });

  it('returns help for "add" containing --title', () => {
    const help = getSubcommandHelp('add');
    expect(help).toBeDefined();
    expect(help).toContain('--title');
    expect(help).toContain('--priority');
    expect(help).toContain('--type');
    expect(help).toContain('--context');
    expect(help).toContain('--depends-on');
  });

  it('returns undefined for unknown subcommand', () => {
    const help = getSubcommandHelp('unknown');
    expect(help).toBeUndefined();
  });

  it('each subcommand help includes a one-line description', () => {
    const commands = ['run', 'status', 'report', 'history', 'add'];
    for (const cmd of commands) {
      const help = getSubcommandHelp(cmd);
      expect(help).toContain(`cowork ${cmd}`);
    }
  });

  it('each subcommand help includes examples section', () => {
    const commands = ['run', 'status', 'report', 'history', 'add'];
    for (const cmd of commands) {
      const help = getSubcommandHelp(cmd);
      expect(help).toContain('Examples:');
    }
  });

  it('global usage text mentions <command> --help', async () => {
    const { readFile } = await import('node:fs/promises');
    const cliSource = await readFile(
      new URL('./cli.ts', import.meta.url).pathname,
      'utf-8',
    );
    expect(cliSource).toContain('<command> --help');
  });
});
