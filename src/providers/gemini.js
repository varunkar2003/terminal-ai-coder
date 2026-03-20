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
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n' : '') + msg.content;
      continue;
    }

    // Handle tool result messages
    if (msg.role === 'tool') {
      const last = contents[contents.length - 1];
      const part = {
        functionResponse: {
          name: msg.name || 'unknown',
          response: { result: msg.content },
        },
      };
      if (last && last.role === 'function') {
        last.parts.push(part);
      } else {
        contents.push({ role: 'function', parts: [part] });
      }
      continue;
    }

    // Handle assistant messages with tool calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      const parts = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        });
      }
      contents.push({ role: 'model', parts });
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];

    if (last && last.role === role) {
      last.parts.push({ text: msg.content });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? config.temperature,
    },
  };

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = [{
      functionDeclarations: options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = 'unknown'; }
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolCalls = [];

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
          const parts = json.candidates?.[0]?.content?.parts || [];

          for (const part of parts) {
            if (part.text) {
              yield part.text;
            }
            if (part.functionCall) {
              toolCalls.push({
                id: `gemini_${Date.now()}_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args || {}),
                },
              });
            }
          }

          if (json.usageMetadata) {
            yield {
              usage: {
                prompt_tokens: json.usageMetadata.promptTokenCount || 0,
                completion_tokens: json.usageMetadata.candidatesTokenCount || 0,
                total_tokens: json.usageMetadata.totalTokenCount || 0,
              },
            };
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch (err) {
    throw new Error(`Gemini stream error: ${err.message}`);
  }

  if (toolCalls.length > 0) {
    yield { tool_calls: toolCalls };
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
