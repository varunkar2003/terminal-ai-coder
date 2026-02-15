import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const defaults = {
  ollamaHost: 'http://localhost:11434',
  model: 'qwen2.5-coder:7b',
  temperature: 0.2,
  contextWindow: 4096,
  systemPrompt: `You are VKCoder, a coding assistant. Give concise answers with code examples. Use markdown.`,
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
