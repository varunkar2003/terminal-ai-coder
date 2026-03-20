// Learn coding patterns from the project

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { memorySet } from './memory.js';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.next']);

function scanFiles(dir, ext, maxFiles = 20) {
  const files = [];
  function walk(d, depth) {
    if (depth > 4 || files.length >= maxFiles) return;
    try {
      for (const entry of readdirSync(d)) {
        if (IGNORE.has(entry) || entry.startsWith('.')) continue;
        const full = join(d, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) walk(full, depth + 1);
          else if (ext.includes(extname(full)) && stat.size < 50000) files.push(full);
        } catch {}
      }
    } catch {}
  }
  walk(dir, 0);
  return files;
}

export function learnPatterns() {
  const jsFiles = scanFiles(process.cwd(), ['.js', '.ts', '.jsx', '.tsx']);
  const pyFiles = scanFiles(process.cwd(), ['.py']);

  const patterns = {};

  if (jsFiles.length > 0) {
    let arrowCount = 0, functionCount = 0;
    let semicolonCount = 0, noSemicolonCount = 0;
    let singleQuote = 0, doubleQuote = 0;
    let tabCount = 0, spaceCount = 0;
    let constCount = 0, letCount = 0, varCount = 0;
    let tsCount = 0, jsCount = 0;

    for (const f of jsFiles.slice(0, 15)) {
      try {
        const code = readFileSync(f, 'utf-8');
        const lines = code.split('\n');

        arrowCount += (code.match(/=>/g) || []).length;
        functionCount += (code.match(/\bfunction\b/g) || []).length;
        constCount += (code.match(/\bconst\b/g) || []).length;
        letCount += (code.match(/\blet\b/g) || []).length;
        varCount += (code.match(/\bvar\b/g) || []).length;

        for (const line of lines.slice(0, 50)) {
          if (line.match(/;\s*$/)) semicolonCount++;
          else if (line.trim().length > 5) noSemicolonCount++;
          if (line.startsWith('\t')) tabCount++;
          else if (line.startsWith('  ')) spaceCount++;
          singleQuote += (line.match(/'/g) || []).length;
          doubleQuote += (line.match(/"/g) || []).length;
        }

        if (f.endsWith('.ts') || f.endsWith('.tsx')) tsCount++;
        else jsCount++;
      } catch {}
    }

    patterns.language = tsCount > jsCount ? 'TypeScript' : 'JavaScript';
    patterns.functions = arrowCount > functionCount * 1.5 ? 'arrow functions' : 'function declarations';
    patterns.semicolons = semicolonCount > noSemicolonCount ? 'uses semicolons' : 'no semicolons';
    patterns.quotes = singleQuote > doubleQuote ? 'single quotes' : 'double quotes';
    patterns.indentation = tabCount > spaceCount ? 'tabs' : 'spaces';
    patterns.variables = constCount > letCount * 2 ? 'prefers const' : 'uses let/const mix';
    if (varCount > 0 && varCount > letCount) patterns.variables = 'uses var (legacy style)';
  }

  if (pyFiles.length > 0) {
    patterns.language = patterns.language ? patterns.language + ' + Python' : 'Python';
  }

  if (Object.keys(patterns).length === 0) {
    return 'No code files found to analyze.';
  }

  // Save to memory
  const summary = Object.entries(patterns).map(([k, v]) => `${k}: ${v}`).join(', ');
  memorySet('coding_style', summary);

  return `Learned coding patterns:\n${Object.entries(patterns).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}\n\nSaved to memory for future reference.`;
}
