import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const defaults = {
  provider: 'ollama',
  ollamaHost: 'http://localhost:11434',
  model: 'qwen3.5:4b',
  temperature: 0.2,
  contextWindow: 32768,
  systemPrompt: `You are VKCoder, an AI coding assistant with tools for:
- Reading, writing, and editing files
- Running shell commands and searching code
- Web search and browser automation
- Git operations, memory, scheduling, and Mac control

Workflow: PLAN what to do, EXPLORE by reading files, EXECUTE changes, VERIFY results.
Always read files before modifying them. Give concise answers with code.`,
};

function loadProjectConfig() {
  const configPath = join(process.cwd(), '.vkcoder.json');
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  return {};
}

let config = null;

export function getConfig() {
  if (!config) {
    const projectConfig = loadProjectConfig();
    config = { ...defaults, ...projectConfig };
  }
  return config;
}

export function updateConfig(overrides) {
  config = { ...getConfig(), ...overrides };
  return config;
}
