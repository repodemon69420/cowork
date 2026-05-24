import { writeFileContent } from './fs-adapter.js';

export class Logger {
  private buffer: string[] = [];

  private log(level: string, msg: string, fn: (s: string) => void): void {
    const entry = `[${new Date().toISOString()}] [${level}] ${msg}`;
    this.buffer.push(entry);
    fn(entry);
  }

  info(msg: string): void { this.log('INFO', msg, console.log); }
  warn(msg: string): void { this.log('WARN', msg, console.warn); }
  error(msg: string): void { this.log('ERROR', msg, console.error); }

  getLog(): string[] { return [...this.buffer]; }

  flush(filePath: string): void {
    writeFileContent(filePath, this.buffer.join('\n'));
  }
}

export function createLogger(): Logger { return new Logger(); }
