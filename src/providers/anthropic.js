import { getConfig } from '../config.js';

const KNOWN_MODELS = [
  { name: 'claude-sonnet-4-20250514', description: 'Claude Sonnet 4 — fast and capable' },
  { name: 'claude-opus-4-20250514', description: 'Claude Opus 4 — most capable' },
  { name: 'claude-haiku-35-20241022', description: 'Claude Haiku 3.5 — fastest' },
];

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY;
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const model = options.model || config.model;

  // Extract system message from messages array
  let systemText = '';
  const filteredMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n' : '') + msg.content;
    } else {
      filteredMessages.push(msg);
    }
  }

  const body = {
    model,
    messages: filteredMessages,
    max_tokens: 4096,
    stream: true,
    temperature: options.temperature ?? config.temperature,
  };

  if (systemText) {
    body.system = systemText;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = 'unknown'; }
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

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

        try {
          const json = JSON.parse(data);
          if (json.type === 'message_start' && json.message?.usage) {
            inputTokens = json.message.usage.input_tokens || 0;
          }
          if (json.type === 'content_block_delta') {
            const text = json.delta?.text;
            if (text) {
              yield text;
            }
          }
          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens || 0;
          }
          if (json.type === 'message_stop') {
            yield {
              usage: {
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
              },
            };
            return;
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch (err) {
    throw new Error(`Anthropic stream error: ${err.message}`);
  }
}

export async function checkHealth() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY environment variable is not set' };
  }
  return { ok: true };
}

export async function listModels() {
  return KNOWN_MODELS;
}

export function getProviderName() {
  return 'Anthropic';
}
