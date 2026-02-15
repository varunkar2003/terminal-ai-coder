import { getConfig } from '../config.js';

const PROVIDERS = {
  ollama: { module: null, default_model: 'qwen2.5-coder:7b' },
  openai: { module: null, default_model: 'gpt-4o' },
  anthropic: { module: null, default_model: 'claude-sonnet-4-20250514' },
  gemini: { module: null, default_model: 'gemini-2.0-flash' },
};

async function loadProvider(name) {
  if (!PROVIDERS[name]) {
    throw new Error(`Unknown provider: ${name}. Valid providers: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  if (!PROVIDERS[name].module) {
    PROVIDERS[name].module = await import(`./${name}.js`);
  }

  return PROVIDERS[name].module;
}

export async function getProvider(name) {
  const providerName = name || getConfig().provider;
  return loadProvider(providerName);
}

export function getDefaultModel(providerName) {
  const entry = PROVIDERS[providerName];
  return entry ? entry.default_model : null;
}

export function isValidProvider(name) {
  return name in PROVIDERS;
}

export function getProviderNames() {
  return Object.keys(PROVIDERS);
}

export function getKeyEnvVar(providerName) {
  const vars = {
    ollama: null,
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GOOGLE_API_KEY',
  };
  return vars[providerName] || null;
}
