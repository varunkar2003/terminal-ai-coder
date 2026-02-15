import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const PROJECT_MARKERS = {
  'package.json': 'Node.js',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'Cargo.toml': 'Rust',
  'go.mod': 'Go',
  'pom.xml': 'Java',
  'build.gradle': 'Java/Kotlin',
  'Gemfile': 'Ruby',
  'composer.json': 'PHP',
  'CMakeLists.txt': 'C/C++',
  'Makefile': 'Make',
};

function detectProjectType() {
  for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
    if (existsSync(join(process.cwd(), marker))) {
      return { type, marker };
    }
  }
  return { type: 'Unknown', marker: null };
}

function getDirectoryTree(dir, depth = 2, prefix = '') {
  if (depth < 0) return '';

  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', 'target', '.next', 'vendor', 'coverage']);
  let tree = '';

  try {
    const entries = readdirSync(dir).filter(e => !IGNORE.has(e) && !e.startsWith('.'));
    entries.sort((a, b) => {
      const aIsDir = statSync(join(dir, a)).isDirectory();
      const bIsDir = statSync(join(dir, b)).isDirectory();
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          tree += `${prefix}${connector}${entry}/\n`;
          tree += getDirectoryTree(fullPath, depth - 1, prefix + childPrefix);
        } else {
          tree += `${prefix}${connector}${entry}\n`;
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return tree;
}

function readManifest(marker) {
  if (!marker) return null;

  try {
    const content = readFileSync(join(process.cwd(), marker), 'utf-8');

    if (marker === 'package.json') {
      const pkg = JSON.parse(content);
      return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: Object.keys(pkg.scripts || {}),
      };
    }

    // For other types, return first 500 chars
    return content.substring(0, 500);
  } catch {
    return null;
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export function getProjectContext() {
  const cwd = process.cwd();
  const projectName = basename(cwd);
  const { type, marker } = detectProjectType();
  const gitBranch = getGitBranch();
  const manifest = readManifest(marker);
  const tree = getDirectoryTree(cwd);

  let context = `Project: ${projectName} (${type})`;
  if (gitBranch) context += ` [${gitBranch}]`;

  if (manifest && typeof manifest === 'object' && manifest.name) {
    context += `\nPackage: ${manifest.name}@${manifest.version}`;
  }

  return context;
}
