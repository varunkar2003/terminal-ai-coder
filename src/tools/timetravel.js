// Time Travel Debugging — walk through git history to find what broke

import { execSync } from 'child_process';

function git(cmd) {
  return execSync(`git ${cmd}`, {
    cwd: process.cwd(), encoding: 'utf-8', timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export function fileAtCommit(filePath, commitRef) {
  try {
    return git(`show ${commitRef}:${filePath}`);
  } catch (err) {
    throw new Error(`Cannot read ${filePath} at ${commitRef}: ${(err.stderr || err.message).trim()}`);
  }
}

export function fileHistory(filePath, count = 15) {
  const log = git(`log --oneline -${count} -- "${filePath}"`);
  if (!log) return `No git history found for ${filePath}`;
  return `History of ${filePath}:\n${log}`;
}

export function findBugIntroduction(filePath, searchText) {
  // Use git log -S to find which commit introduced/removed a string
  try {
    const log = git(`log --oneline -10 -S "${searchText.replace(/"/g, '\\"')}" -- "${filePath}"`);
    if (!log) return `No commits found that changed "${searchText}" in ${filePath}`;
    return `Commits that changed "${searchText}" in ${filePath}:\n${log}`;
  } catch (err) {
    throw new Error((err.stderr || err.message).trim());
  }
}

export function blame(filePath, lineStart, lineEnd) {
  const range = lineEnd ? `-L ${lineStart},${lineEnd}` : `-L ${lineStart},${lineStart}`;
  try {
    return git(`blame ${range} "${filePath}"`);
  } catch (err) {
    throw new Error((err.stderr || err.message).trim());
  }
}

export function diffBetween(ref1, ref2, filePath) {
  const fileArg = filePath ? `-- "${filePath}"` : '';
  try {
    const diff = git(`diff ${ref1}..${ref2} ${fileArg}`);
    if (!diff) return `No differences between ${ref1} and ${ref2}`;
    return diff.length > 8000 ? diff.substring(0, 8000) + '\n...(truncated)' : diff;
  } catch (err) {
    throw new Error((err.stderr || err.message).trim());
  }
}

export function bisectStart(goodRef, badRef) {
  try {
    git('bisect reset 2>/dev/null || true');
    git('bisect start');
    git(`bisect bad ${badRef || 'HEAD'}`);
    git(`bisect good ${goodRef}`);
    return `Bisect started. Good: ${goodRef}, Bad: ${badRef || 'HEAD'}. Use bisect_step with test command to find the breaking commit.`;
  } catch (err) {
    throw new Error((err.stderr || err.message).trim());
  }
}

export function whatChanged(daysAgo = 7) {
  const since = `${daysAgo} days ago`;
  try {
    const log = git(`log --oneline --since="${since}"`);
    const stats = git(`diff --stat HEAD~$(git rev-list --count --since="${since}" HEAD)..HEAD 2>/dev/null || echo ""`);
    return `Changes in the last ${daysAgo} days:\n\n${log}\n\nStats:\n${stats}`;
  } catch {
    const log = git(`log --oneline -20`);
    return `Recent commits:\n${log}`;
  }
}
