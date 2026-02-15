import { execSync } from 'child_process';

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 50_000;

export function runCommand(command, options = {}) {
  const timeout = options.timeout || TIMEOUT_MS;

  try {
    const stdout = execSync(command, {
      cwd: process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
      shell: '/bin/sh',
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        TERM: 'dumb',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const output = stdout.length > MAX_OUTPUT
      ? stdout.substring(0, MAX_OUTPUT) + '\n... (output truncated)'
      : stdout;

    return { success: true, output, exitCode: 0 };
  } catch (err) {
    if (err.killed) {
      return {
        success: false,
        output: `Command timed out after ${timeout / 1000}s and was killed`,
        exitCode: null,
      };
    }

    const output = (err.stdout || '') + (err.stderr || '');
    return {
      success: false,
      output: output.length > MAX_OUTPUT
        ? output.substring(0, MAX_OUTPUT) + '\n... (output truncated)'
        : output || err.message,
      exitCode: err.status ?? 1,
    };
  }
}
