import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const changeHistory = [];
const MAX_HISTORY = 20;

export function recordChange(filePath, oldContent) {
  const absPath = resolve(process.cwd(), filePath);
  changeHistory.push({
    filePath: absPath,
    oldContent,
    timestamp: Date.now(),
  });
  if (changeHistory.length > MAX_HISTORY) changeHistory.shift();
}

export function undoLast() {
  if (changeHistory.length === 0) return 'Nothing to undo.';
  const last = changeHistory.pop();
  writeFileSync(last.filePath, last.oldContent, 'utf-8');
  return `Reverted: ${last.filePath}`;
}

export function undoHistory() {
  if (changeHistory.length === 0) return 'No changes to undo.';
  return changeHistory.map((c, i) =>
    `${i + 1}. ${c.filePath} (${new Date(c.timestamp).toLocaleTimeString()})`
  ).join('\n');
}
