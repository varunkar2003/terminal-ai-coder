import { getConfig } from '../config.js';

const KNOWN_MODELS = [
  { name: 'gpt-4o', description: 'Most capable GPT-4o model' },
  { name: 'gpt-4o-mini', description: 'Fast and affordable GPT-4o' },
  { name: 'gpt-4-turbo', description: 'GPT-4 Turbo with vision' },
  { name: 'gpt-3.5-turbo', description: 'Fast GPT-3.5 model' },
];

function getApiKey() {
  return process.env.OPENAI_API_KEY;
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const model = options.model || config.model;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? config.temperature,
    }),
  });

  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = 'unknown'; }
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch (err) {
    throw new Error(`OpenAI stream error: ${err.message}`);
  }
}

export async function checkHealth() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY environment variable is not set' };
  }
  return { ok: true };
}

export async function listModels() {
  return KNOWN_MODELS;
}

export function getProviderName() {
  return 'OpenAI';
}
