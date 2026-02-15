import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const defaults = {
  ollamaHost: 'http://localhost:11434',
  model: 'starcoder2:3b',
  temperature: 0.2,
  contextWindow: 8192,
  systemPrompt: `You are VKCoder, a helpful AI coding assistant running locally via Ollama.
You help developers write, debug, and understand code directly in the terminal.

Guidelines:
- Give concise, practical answers
- Include code examples when helpful
- Use markdown formatting for readability
- When showing code, always specify the language for syntax highlighting
- If you don't know something, say so honestly
- Focus on the user's current project context when available`,
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
