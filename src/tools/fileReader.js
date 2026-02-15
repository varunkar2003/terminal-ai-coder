import { readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import { highlightCode } from '../ui/renderer.js';

const MAX_FILE_SIZE = 100 * 1024; // 100KB

function validatePath(filePath) {
  const resolved = resolve(process.cwd(), filePath);
  const rel = relative(process.cwd(), resolved);
  if (rel.startsWith('..')) {
    throw new Error(`Path traversal denied: ${filePath} is outside the project directory`);
  }
  return resolved;
}

export function readFile(filePath, options = {}) {
  const absPath = validatePath(filePath);

  const stat = statSync(absPath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(stat.size / 1024).toFixed(1)}KB). Max: ${MAX_FILE_SIZE / 1024}KB. Use --lines to read a range.`);
  }

  let content = readFileSync(absPath, 'utf-8');

  // Line range support: --lines start-end
  if (options.lines) {
    const [start, end] = options.lines.split('-').map(Number);
    const allLines = content.split('\n');
    const startIdx = Math.max(0, start - 1);
    const endIdx = end ? Math.min(allLines.length, end) : allLines.length;
    content = allLines.slice(startIdx, endIdx).join('\n');

    // Add line numbers
    const numbered = content.split('\n').map((line, i) => {
      const lineNum = String(startIdx + i + 1).padStart(4, ' ');
      return `${lineNum} │ ${line}`;
    }).join('\n');

    return { content: numbered, lineRange: `${startIdx + 1}-${endIdx}`, total: allLines.length };
  }

  // Add line numbers
  const numbered = content.split('\n').map((line, i) => {
    const lineNum = String(i + 1).padStart(4, ' ');
    return `${lineNum} │ ${line}`;
  }).join('\n');

  const total = content.split('\n').length;
  return { content: numbered, total };
}

export function readFileRaw(filePath) {
  const absPath = validatePath(filePath);
  return readFileSync(absPath, 'utf-8');
}

export function parseReadArgs(argsStr) {
  const parts = argsStr.trim().split(/\s+/);
  const result = { filePath: parts[0] };

  const linesIdx = parts.indexOf('--lines');
  if (linesIdx !== -1 && parts[linesIdx + 1]) {
    result.lines = parts[linesIdx + 1];
  }

  return result;
}
