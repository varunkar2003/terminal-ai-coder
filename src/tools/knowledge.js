// Decentralized Knowledge Base — cross-project learning

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const KB_DIR = join(homedir(), '.vkcoder', 'knowledge');

function ensureDir() {
  if (!existsSync(KB_DIR)) mkdirSync(KB_DIR, { recursive: true });
}

function getProjectId() {
  return basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '_');
}

export function saveKnowledge(topic, content) {
  ensureDir();
  const projectId = getProjectId();
  const filepath = join(KB_DIR, `${projectId}.json`);

  let kb = {};
  try { kb = JSON.parse(readFileSync(filepath, 'utf-8')); } catch {}

  kb[topic] = {
    content,
    project: basename(process.cwd()),
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(filepath, JSON.stringify(kb, null, 2), 'utf-8');
  return `Knowledge saved: "${topic}" for project ${basename(process.cwd())}`;
}

export function getKnowledge(topic) {
  ensureDir();

  // Search across all projects
  const results = [];
  const files = readdirSync(KB_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const kb = JSON.parse(readFileSync(join(KB_DIR, file), 'utf-8'));
      for (const [key, entry] of Object.entries(kb)) {
        if (key.toLowerCase().includes(topic.toLowerCase()) ||
            entry.content.toLowerCase().includes(topic.toLowerCase())) {
          results.push({
            topic: key,
            content: entry.content,
            project: entry.project,
            date: entry.updatedAt,
          });
        }
      }
    } catch {}
  }

  if (results.length === 0) return `No knowledge found for: "${topic}"`;

  return results.map(r =>
    `[${r.project}] ${r.topic}:\n${r.content.substring(0, 300)}`
  ).join('\n\n');
}

export function listAllKnowledge() {
  ensureDir();
  const files = readdirSync(KB_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) return 'Knowledge base is empty. Use save_knowledge to add entries.';

  const entries = [];
  for (const file of files) {
    try {
      const kb = JSON.parse(readFileSync(join(KB_DIR, file), 'utf-8'));
      for (const [key, entry] of Object.entries(kb)) {
        entries.push(`[${entry.project}] ${key}`);
      }
    } catch {}
  }

  return entries.length > 0
    ? `Knowledge base (${entries.length} entries):\n${entries.join('\n')}`
    : 'Knowledge base is empty.';
}

export function learnFromProject() {
  ensureDir();
  const projectId = getProjectId();
  const projectName = basename(process.cwd());
  const learned = [];

  // Detect tech stack
  const markers = {
    'package.json': 'Node.js',
    'requirements.txt': 'Python',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'pom.xml': 'Java',
    'Gemfile': 'Ruby',
    'composer.json': 'PHP',
  };

  for (const [file, tech] of Object.entries(markers)) {
    if (existsSync(join(process.cwd(), file))) {
      learned.push({ topic: 'tech_stack', content: tech });
      break;
    }
  }

  // Read package.json for more details
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    if (pkg.dependencies) {
      const deps = Object.keys(pkg.dependencies).join(', ');
      learned.push({ topic: 'dependencies', content: deps });
    }
    if (pkg.scripts) {
      const scripts = Object.entries(pkg.scripts).map(([k, v]) => `${k}: ${v}`).join('\n');
      learned.push({ topic: 'scripts', content: scripts });
    }
  } catch {}

  // Save all learned items
  for (const item of learned) {
    saveKnowledge(item.topic, item.content);
  }

  return `Learned ${learned.length} items from ${projectName}:\n${learned.map(l => `- ${l.topic}: ${l.content.substring(0, 100)}`).join('\n')}`;
}
