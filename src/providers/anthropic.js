import { getConfig } from '../config.js';

const KNOWN_MODELS = [
  { name: 'claude-sonnet-4-20250514', description: 'Claude Sonnet 4 — fast and capable' },
  { name: 'claude-opus-4-20250514', description: 'Claude Opus 4 — most capable' },
  { name: 'claude-haiku-35-20241022', description: 'Claude Haiku 3.5 — fastest' },
];

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY;
}

function convertToolsForAnthropic(tools) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

function convertMessagesForAnthropic(messages) {
  let systemText = '';
  const filtered = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n' : '') + msg.content;
      continue;
    }

    // Handle assistant messages with tool calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      const content = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
      filtered.push({ role: 'assistant', content });
      continue;
    }

    // Handle tool result messages
    if (msg.role === 'tool') {
      // Anthropic expects tool results as user messages with tool_result content
      const last = filtered[filtered.length - 1];
      const block = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: msg.content,
      };
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        filtered.push({ role: 'user', content: [block] });
      }
      continue;
    }

    filtered.push({ role: msg.role, content: msg.content });
  }

  return { systemText, filtered };
}

export async function* streamChat(messages, options = {}) {
  const config = getConfig();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const model = options.model || config.model;
  const { systemText, filtered } = convertMessagesForAnthropic(messages);

  const body = {
    model,
    messages: filtered,
    max_tokens: 4096,
    stream: true,
    temperature: options.temperature ?? config.temperature,
  };

  if (systemText) {
    body.system = systemText;
  }

  const anthropicTools = convertToolsForAnthropic(options.tools);
  if (anthropicTools) {
    body.tools = anthropicTools;
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

  // Tool call accumulation
  const toolCalls = [];
  let currentToolCall = null;
  let toolJsonBuffer = '';

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

          if (json.type === 'content_block_start') {
            if (json.content_block?.type === 'tool_use') {
              currentToolCall = {
                id: json.content_block.id,
                type: 'function',
                function: {
                  name: json.content_block.name,
                  arguments: '',
                },
              };
              toolJsonBuffer = '';
            }
          }

          if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'text_delta') {
              const text = json.delta.text;
              if (text) yield text;
            }
            if (json.delta?.type === 'input_json_delta' && currentToolCall) {
              toolJsonBuffer += json.delta.partial_json || '';
            }
          }

          if (json.type === 'content_block_stop' && currentToolCall) {
            currentToolCall.function.arguments = toolJsonBuffer;
            toolCalls.push(currentToolCall);
            currentToolCall = null;
            toolJsonBuffer = '';
          }

          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens || 0;
          }

          if (json.type === 'message_stop') {
            if (toolCalls.length > 0) {
              yield { tool_calls: toolCalls };
            }
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
