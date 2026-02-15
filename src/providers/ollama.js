import { getConfig } from '../config.js';
import {
  checkOllamaHealth,
  checkModelAvailable,
  listModels as ollamaListModels,
  streamChat as ollamaStreamChat,
} from '../model.js';

export { checkModelAvailable };

export async function* streamChat(messages, options = {}) {
  yield* ollamaStreamChat(messages, options);
}

export async function checkHealth() {
  const healthy = await checkOllamaHealth();
  if (!healthy) {
    const { ollamaHost } = getConfig();
    return { ok: false, error: `Cannot connect to Ollama at ${ollamaHost}. Is Ollama running?` };
  }
  return { ok: true };
}

export async function listModels() {
  const models = await ollamaListModels();
  return models.map(m => ({ name: m.name }));
}

export function getProviderName() {
  return 'Ollama (local)';
}
