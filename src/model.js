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

// Convert messages to Ollama's expected format:
// - assistant tool_calls: arguments must be object, not string
// - tool results: only role + content (no extra fields)
function convertMessagesForOllama(messages) {
  return messages.map(msg => {
    if (msg.role === 'assistant' && msg.tool_calls) {
      return {
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls.map(tc => ({
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
          },
        })),
      };
    }
    if (msg.role === 'tool') {
      return { role: 'tool', content: msg.content || '' };
    }
    return msg;
  });
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const { ollamaHost, model, temperature } = config;
  const modelName = options.model || model;

  const ollamaMessages = convertMessagesForOllama(messages);

  const body = {
    model: modelName,
    messages: ollamaMessages,
    stream: true,
    options: {
      temperature: options.temperature ?? temperature,
      num_ctx: config.contextWindow,
    },
  };

  // Add tool definitions if provided
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

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
  const toolCalls = [];

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
          // Collect tool calls from Ollama
          if (json.message?.tool_calls) {
            for (const tc of json.message.tool_calls) {
              toolCalls.push({
                id: `ollama_${Date.now()}_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: typeof tc.function.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function.arguments),
                },
              });
            }
          }
          if (json.done) {
            if (toolCalls.length > 0) {
              yield { tool_calls: toolCalls };
            }
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
      if (json.message?.tool_calls) {
        for (const tc of json.message.tool_calls) {
          toolCalls.push({
            id: `ollama_${Date.now()}_${toolCalls.length}`,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: typeof tc.function.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments),
            },
          });
        }
      }
      if (json.done) {
        if (toolCalls.length > 0) {
          yield { tool_calls: toolCalls };
        }
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
