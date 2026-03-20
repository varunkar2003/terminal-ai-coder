// Git automation tools

import { execSync } from 'child_process';

function git(command) {
  try {
    return execSync(`git ${command}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    throw new Error(output.trim() || err.message);
  }
}

export function gitStatus() {
  const status = git('status --short');
  const branch = git('rev-parse --abbrev-ref HEAD');
  const ahead = git('rev-list --count @{u}..HEAD 2>/dev/null || echo 0');
  const behind = git('rev-list --count HEAD..@{u} 2>/dev/null || echo 0');

  let result = `Branch: ${branch}`;
  if (ahead !== '0' || behind !== '0') {
    result += ` (${ahead} ahead, ${behind} behind)`;
  }
  result += '\n\n' + (status || '(clean — no changes)');
  return result;
}

export function gitDiff(staged = false) {
  const diff = git(staged ? 'diff --cached' : 'diff');
  if (!diff) return staged ? 'No staged changes.' : 'No unstaged changes.';
  // Truncate large diffs
  if (diff.length > 8000) {
    return diff.substring(0, 8000) + '\n\n... (diff truncated)';
  }
  return diff;
}

export function gitLog(count = 10) {
  return git(`log --oneline -${count}`);
}

export function gitCommit(message) {
  git('add -A');
  return git(`commit -m "${message.replace(/"/g, '\\"')}"`);
}

export function gitPush() {
  return git('push');
}

export function gitPull() {
  return git('pull');
}

export function gitBranch(name) {
  if (name) {
    git(`checkout -b ${name}`);
    return `Created and switched to branch: ${name}`;
  }
  return git('branch -a');
}

export function gitCheckout(ref) {
  git(`checkout ${ref}`);
  return `Switched to: ${ref}`;
}

export function gitStash(action = 'push') {
  return git(`stash ${action}`);
}
