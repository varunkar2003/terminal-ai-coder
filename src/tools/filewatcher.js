// Ambient awareness — watch for file changes and notify

import { watch } from 'fs';
import { join, relative } from 'path';

const watchers = new Map();
let changeCallback = null;
const recentChanges = [];
const MAX_CHANGES = 50;

export function setChangeCallback(cb) {
  changeCallback = cb;
}

export function watchProject(dir = process.cwd()) {
  if (watchers.has(dir)) return 'Already watching this directory.';

  const IGNORE = /node_modules|\.git|dist|build|\.next|__pycache__|\.DS_Store/;

  try {
    const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename || IGNORE.test(filename)) return;

      const change = {
        type: eventType,
        file: filename,
        time: new Date().toISOString(),
      };

      recentChanges.push(change);
      if (recentChanges.length > MAX_CHANGES) recentChanges.shift();

      if (changeCallback) {
        changeCallback(change);
      }
    });

    watchers.set(dir, watcher);
    return `Watching ${dir} for file changes.`;
  } catch (err) {
    return `Failed to watch: ${err.message}`;
  }
}

export function stopWatching(dir = process.cwd()) {
  const watcher = watchers.get(dir);
  if (!watcher) return 'Not watching this directory.';
  watcher.close();
  watchers.delete(dir);
  return `Stopped watching ${dir}.`;
}

export function getRecentChanges(count = 20) {
  if (recentChanges.length === 0) return 'No file changes detected yet.';
  return recentChanges.slice(-count).map(c =>
    `${c.time.split('T')[1].split('.')[0]} ${c.type} ${c.file}`
  ).join('\n');
}

export function isWatching() {
  return watchers.size > 0;
}
