import { glob } from 'glob';

const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.next/**',
  '__pycache__/**',
  '*.pyc',
  'target/**',
  'vendor/**',
];

const MAX_RESULTS = 50;

export async function globSearch(pattern, options = {}) {
  const ignore = options.ignore || DEFAULT_IGNORE;

  const matches = await glob(pattern, {
    cwd: process.cwd(),
    ignore,
    nodir: false,
    dot: false,
  });

  const sorted = matches.sort();
  const truncated = sorted.length > MAX_RESULTS;
  const results = sorted.slice(0, MAX_RESULTS);

  return {
    results,
    total: sorted.length,
    truncated,
    pattern,
  };
}
