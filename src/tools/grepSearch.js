import { readFileSync } from 'fs';
import { glob } from 'glob';

const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
];

const MAX_RESULTS = 20;
const MAX_LINE_LENGTH = 200;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.exe', '.dll', '.so', '.dylib', '.o',
  '.wasm', '.pyc', '.class',
]);

function isBinary(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}

export async function grepSearch(pattern, fileGlob = '**/*', options = {}) {
  const ignore = options.ignore || DEFAULT_IGNORE;

  const files = await glob(fileGlob, {
    cwd: process.cwd(),
    ignore,
    nodir: true,
    dot: false,
  });

  let regex;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }

  const results = [];

  for (const file of files) {
    if (isBinary(file)) continue;
    if (results.length >= MAX_RESULTS) break;

    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= MAX_RESULTS) break;

        if (regex.test(lines[i])) {
          const line = lines[i].length > MAX_LINE_LENGTH
            ? lines[i].substring(0, MAX_LINE_LENGTH) + '...'
            : lines[i];

          results.push({
            file,
            line: i + 1,
            content: line.trimStart(),
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return {
    results,
    total: results.length,
    pattern,
    fileGlob,
    truncated: results.length >= MAX_RESULTS,
  };
}
