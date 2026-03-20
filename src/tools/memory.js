// Persistent memory — remembers things across all sessions and modes

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MEMORY_DIR = join(homedir(), '.vkcoder');
const MEMORY_FILE = join(MEMORY_DIR, 'memory.json');

let memoryCache = null;

function loadMemory() {
  if (memoryCache) return memoryCache;
  try {
    if (existsSync(MEMORY_FILE)) {
      memoryCache = JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'));
    } else {
      memoryCache = {};
    }
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

function saveMemory() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(memoryCache, null, 2), 'utf-8');
}

export function memorySet(key, value) {
  loadMemory();
  memoryCache[key] = { value, savedAt: new Date().toISOString() };
  saveMemory();
  return `Remembered: "${key}" = "${value}"`;
}

export function memoryGet(key) {
  loadMemory();
  if (key in memoryCache) {
    return memoryCache[key].value;
  }
  return `No memory found for: ${key}`;
}

export function memoryList() {
  loadMemory();
  const keys = Object.keys(memoryCache);
  if (keys.length === 0) return 'No memories stored yet.';
  return keys.map(k => `- ${k}: ${memoryCache[k].value}`).join('\n');
}

export function memoryDelete(key) {
  loadMemory();
  if (key in memoryCache) {
    delete memoryCache[key];
    saveMemory();
    return `Forgotten: "${key}"`;
  }
  return `No memory found for: ${key}`;
}
