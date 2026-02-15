import { getConfig } from './config.js';
import { Agent } from 'undici';

// Ollama can be very slow (model loading, cold starts on limited RAM).
// Disable Node.js/undici default 300s headers timeout.
const ollamaDispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
});

export async function checkOllamaHealth() {
  const { ollamaHost } = getConfig();
  try {
    const res = await fetch(ollamaHost, { dispatcher: ollamaDispatcher });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels() {
  const { ollamaHost } = getConfig();
  const res = await fetch(`${ollamaHost}/api/tags`, { dispatcher: ollamaDispatcher });
  if (!res.ok) throw new Error('Failed to list models');
  const data = await res.json();
  return data.models || [];
}

export async function checkModelAvailable(modelName) {
  try {
    const models = await listModels();
    return models.some(m => m.name === modelName || m.name === `${modelName}:latest`);
  } catch {
    return false;
  }
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const { ollamaHost, model, temperature } = config;
  const modelName = options.model || model;

  const body = {
    model: modelName,
    messages,
    stream: true,
    options: {
      temperature: options.temperature ?? temperature,
      num_ctx: config.contextWindow,
    },
  };

  let res;
  try {
    res = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      dispatcher: ollamaDispatcher,
    });
  } catch (err) {
    throw new Error(`Cannot connect to Ollama: ${err.cause?.code || err.message}. Is Ollama running?`);
  }

  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = 'unknown'; }
    throw new Error(`Ollama error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
          if (json.done) {
            yield {
              usage: {
                prompt_tokens: json.prompt_eval_count || 0,
                completion_tokens: json.eval_count || 0,
                total_tokens: (json.prompt_eval_count || 0) + (json.eval_count || 0),
              },
            };
            return;
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    throw new Error(`Stream error: ${err.message}`);
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer);
      if (json.message?.content) {
        yield json.message.content;
      }
      if (json.done) {
        yield {
          usage: {
            prompt_tokens: json.prompt_eval_count || 0,
            completion_tokens: json.eval_count || 0,
            total_tokens: (json.prompt_eval_count || 0) + (json.eval_count || 0),
          },
        };
      }
    } catch {
      // skip
    }
  }
}
