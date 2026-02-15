import { getConfig } from '../config.js';

const KNOWN_MODELS = [
  { name: 'gemini-2.0-flash', description: 'Fast and versatile Gemini model' },
  { name: 'gemini-1.5-pro', description: 'Most capable Gemini model' },
  { name: 'gemini-1.5-flash', description: 'Fast Gemini 1.5 model' },
];

function getApiKey() {
  return process.env.GOOGLE_API_KEY;
}

function convertMessages(messages) {
  // Convert OpenAI-style messages to Gemini format
  // system/user -> "user" role, assistant -> "model" role
  // Merge consecutive same-role messages
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n' : '') + msg.content;
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];

    if (last && last.role === role) {
      // Merge consecutive same-role messages
      last.parts.push({ text: msg.content });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Prepend system text as a user message if present
  if (systemText) {
    if (contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts.unshift({ text: systemText });
    } else {
      contents.unshift({ role: 'user', parts: [{ text: systemText }] });
    }
  }

  return contents;
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  const model = options.model || config.model;
  const contents = convertMessages(messages);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: options.temperature ?? config.temperature,
      },
    }),
  });

  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = 'unknown'; }
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
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

        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch (err) {
    throw new Error(`Gemini stream error: ${err.message}`);
  }
}

export async function checkHealth() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'GOOGLE_API_KEY environment variable is not set' };
  }
  return { ok: true };
}

export async function listModels() {
  return KNOWN_MODELS;
}

export function getProviderName() {
  return 'Google Gemini';
}
