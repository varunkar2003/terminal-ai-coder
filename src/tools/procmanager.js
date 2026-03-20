// Process Manager — start, stop, and monitor background processes

import { spawn } from 'child_process';
import { platform } from 'os';

const processes = new Map();

export function startProcess(name, command) {
  if (processes.has(name)) {
    return `Process "${name}" is already running (PID: ${processes.get(name).pid}). Stop it first.`;
  }

  const shell = platform() === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/sh';
  const shellArgs = platform() === 'win32' ? ['/c', command] : ['-c', command];

  const proc = spawn(shell, shellArgs, {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  const logs = [];
  const MAX_LOGS = 100;

  proc.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push({ time: Date.now(), stream: 'stdout', text: line });
      if (logs.length > MAX_LOGS) logs.shift();
    }
  });

  proc.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push({ time: Date.now(), stream: 'stderr', text: line });
      if (logs.length > MAX_LOGS) logs.shift();
    }
  });

  proc.on('exit', (code) => {
    const entry = processes.get(name);
    if (entry) {
      entry.running = false;
      entry.exitCode = code;
    }
  });

  processes.set(name, {
    pid: proc.pid,
    command,
    startedAt: Date.now(),
    running: true,
    exitCode: null,
    process: proc,
    logs,
  });

  return `Started "${name}" (PID: ${proc.pid}): ${command}`;
}

export function stopProcess(name) {
  const entry = processes.get(name);
  if (!entry) return `No process found: ${name}`;
  if (!entry.running) return `Process "${name}" already stopped (exit code: ${entry.exitCode})`;

  try {
    entry.process.kill('SIGTERM');
    setTimeout(() => {
      try { entry.process.kill('SIGKILL'); } catch {}
    }, 3000);
  } catch {}

  entry.running = false;
  return `Stopped "${name}" (PID: ${entry.pid})`;
}

export function processLogs(name, count = 20) {
  const entry = processes.get(name);
  if (!entry) return `No process found: ${name}`;

  const recent = entry.logs.slice(-count);
  if (recent.length === 0) return `No logs for "${name}" yet.`;

  return recent.map(l => {
    const time = new Date(l.time).toLocaleTimeString();
    const prefix = l.stream === 'stderr' ? '[ERR]' : '[OUT]';
    return `${time} ${prefix} ${l.text}`;
  }).join('\n');
}

export function listProcesses() {
  if (processes.size === 0) return 'No managed processes.';

  const lines = [];
  for (const [name, entry] of processes) {
    const status = entry.running ? `running (PID: ${entry.pid})` : `stopped (exit: ${entry.exitCode})`;
    const uptime = entry.running ? `${Math.round((Date.now() - entry.startedAt) / 1000)}s` : '';
    lines.push(`${name}: ${status} ${uptime}\n  Command: ${entry.command}`);
  }
  return lines.join('\n\n');
}

export function restartProcess(name) {
  const entry = processes.get(name);
  if (!entry) return `No process found: ${name}`;

  const command = entry.command;
  stopProcess(name);
  processes.delete(name);

  // Small delay before restart
  return startProcess(name, command);
}

// Cleanup on exit
process.on('exit', () => {
  for (const [, entry] of processes) {
    try { entry.process.kill(); } catch {}
  }
});
