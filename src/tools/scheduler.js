// Scheduled tasks — run prompts or commands on intervals

const activeTasks = new Map();

let notifyCallback = null;

export function setNotifyCallback(cb) {
  notifyCallback = cb;
}

export function scheduleTask(name, action, intervalMinutes) {
  if (activeTasks.has(name)) {
    clearInterval(activeTasks.get(name).timer);
  }

  const ms = intervalMinutes * 60 * 1000;

  const task = {
    name,
    action,
    intervalMinutes,
    lastRun: null,
    lastResult: null,
    created: new Date().toISOString(),
    timer: null,
  };

  task.timer = setInterval(async () => {
    task.lastRun = new Date().toISOString();
    try {
      // If action looks like a shell command, run it
      const { runCommand } = await import('./executor.js');
      const result = runCommand(action);
      task.lastResult = result.success
        ? (result.output || '(no output)')
        : `FAILED (exit ${result.exitCode}): ${result.output}`;

      // Notify if there's a callback and task failed or has output
      if (notifyCallback) {
        notifyCallback(name, task.lastResult);
      }
    } catch (err) {
      task.lastResult = `Error: ${err.message}`;
      if (notifyCallback) {
        notifyCallback(name, task.lastResult);
      }
    }
  }, ms);

  activeTasks.set(name, task);
  return `Scheduled "${name}" to run every ${intervalMinutes} minute(s).\nAction: ${action}`;
}

export function listTasks() {
  if (activeTasks.size === 0) return 'No scheduled tasks.';

  const lines = [];
  for (const [name, task] of activeTasks) {
    lines.push(
      `- ${name}: every ${task.intervalMinutes}m | action: ${task.action}` +
      (task.lastRun ? `\n  Last run: ${task.lastRun}` : '') +
      (task.lastResult ? `\n  Result: ${task.lastResult.substring(0, 100)}` : '')
    );
  }
  return lines.join('\n\n');
}

export function cancelTask(name) {
  if (!activeTasks.has(name)) return `No task found: ${name}`;
  clearInterval(activeTasks.get(name).timer);
  activeTasks.delete(name);
  return `Cancelled task: ${name}`;
}

export function cancelAllTasks() {
  for (const [, task] of activeTasks) {
    clearInterval(task.timer);
  }
  const count = activeTasks.size;
  activeTasks.clear();
  return `Cancelled ${count} task(s).`;
}
