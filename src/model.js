import { getConfig } from './config.js';

export async function checkOllamaHealth() {
  const { ollamaHost } = getConfig();
  try {
    const res = await fetch(ollamaHost);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels() {
  const { ollamaHost } = getConfig();
  const res = await fetch(`${ollamaHost}/api/tags`);
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
    },
  };

  const res = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
        if (json.done) return;
      } catch {
        // skip malformed JSON lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer);
      if (json.message?.content) {
        yield json.message.content;
      }
    } catch {
      // skip
    }
  }
}
