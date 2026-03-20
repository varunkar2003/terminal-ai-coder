import { getConfig, updateConfig } from './config.js';
import { getProvider, getDefaultModel, isValidProvider } from './providers/router.js';
import { Conversation } from './context/conversation.js';
import { getProjectContext } from './context/project.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { runAgent } from './agent.js';

const API_BASE = 'https://api.telegram.org/bot';

// ─── Telegram API helpers ───────────────────────────────────────────────────

async function tgCall(token, method, body = {}) {
  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API error: ${data.description}`);
  return data.result;
}

async function sendMessage(token, chatId, text) {
  // Telegram has a 4096 char limit per message
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.substring(i, i + 4000));
  }
  for (const chunk of chunks) {
    await tgCall(token, 'sendMessage', {
      chat_id: chatId,
      text: chunk,
      parse_mode: 'Markdown',
    }).catch(() => {
      // Retry without markdown if it fails
      return tgCall(token, 'sendMessage', { chat_id: chatId, text: chunk });
    });
  }
}

async function sendTyping(token, chatId) {
  await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
}

// ─── Conversation per chat ──────────────────────────────────────────────────

const conversations = new Map();

function getConversation(chatId) {
  if (!conversations.has(chatId)) {
    const conv = new Conversation();
    const config = getConfig();
    const ctx = getProjectContext();
    conv.setSystemPrompt(`${config.systemPrompt}\n\n${ctx}`);
    conversations.set(chatId, conv);
  }
  return conversations.get(chatId);
}

// ─── Handle incoming message ────────────────────────────────────────────────

async function handleMessage(token, message) {
  const chatId = message.chat.id;
  const text = message.text;

  if (!text) return;

  // Commands
  if (text === '/start') {
    await sendMessage(token, chatId, '★ *VKCoder* — AI Coding Assistant\n\nSend me any coding question or task. I can read files, write code, run commands, and search the web.\n\nCommands:\n/clear — Clear conversation\n/model — Show current model');
    return;
  }

  if (text === '/clear') {
    conversations.delete(chatId);
    await sendMessage(token, chatId, 'Conversation cleared.');
    return;
  }

  if (text === '/model') {
    const config = getConfig();
    await sendMessage(token, chatId, `Model: ${config.model} (${config.provider})`);
    return;
  }

  const conversation = getConversation(chatId);
  const config = getConfig();
  const provider = await getProvider();

  await sendTyping(token, chatId);

  // Keep sending typing indicator while processing
  const typingInterval = setInterval(() => sendTyping(token, chatId), 4000);

  try {
    const toolMessages = [];

    const result = await runAgent(text, {
      conversation,
      provider,
      config,
      tools: TOOL_DEFINITIONS,
      autoApprove: true,
      maxRounds: 10,
      callbacks: {
        onToolCall(name, args) {
          const argsStr = JSON.stringify(args);
          const short = argsStr.length > 60 ? argsStr.substring(0, 60) + '...' : argsStr;
          toolMessages.push(`🔧 ${name} ${short}`);
        },
        onToolResult(name, result) {
          const lines = result.split('\n');
          if (lines.length > 5) {
            toolMessages.push(`→ ${lines.slice(0, 3).join('\n')}...(${lines.length} lines)`);
          }
        },
        onToolError(name, err) {
          toolMessages.push(`❌ ${name}: ${err.message}`);
        },
        onError(err) {
          toolMessages.push(`Error: ${err.message}`);
        },
      },
    });

    clearInterval(typingInterval);

    // Send tool summary if any
    if (toolMessages.length > 0) {
      await sendMessage(token, chatId, toolMessages.join('\n'));
    }

    // Send the response
    if (result.fullText) {
      await sendMessage(token, chatId, result.fullText);
    } else if (result.error) {
      await sendMessage(token, chatId, `Error: ${result.error}`);
    }

  } catch (err) {
    clearInterval(typingInterval);
    await sendMessage(token, chatId, `Error: ${err.message}`);
  }
}

// ─── Polling loop ───────────────────────────────────────────────────────────

async function pollUpdates(token) {
  let offset = 0;

  while (true) {
    try {
      const updates = await tgCall(token, 'getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message'],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          // Process in background — don't block polling
          handleMessage(token, update.message).catch(err => {
            console.error('Error handling message:', err.message);
          });
        }
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      // Wait before retrying
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ─── Startup checks ────────────────────────────────────────────────────────

async function runStartupChecks() {
  const config = getConfig();
  const provider = await getProvider();

  const health = await provider.checkHealth();
  if (!health.ok) {
    console.error(`Error: ${health.error}`);
    process.exit(1);
  }

  if (config.provider === 'ollama') {
    const { checkModelAvailable } = await import('./providers/ollama.js');
    const available = await checkModelAvailable(config.model);
    if (!available) {
      console.error(`Model ${config.model} not found. Run: ollama pull ${config.model}`);
      process.exit(1);
    }
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function startTelegram(options = {}) {
  const { modelOverride, providerOverride } = options;

  if (providerOverride) {
    if (!isValidProvider(providerOverride)) {
      console.error(`Unknown provider: ${providerOverride}`);
      process.exit(1);
    }
    updateConfig({ provider: providerOverride, model: getDefaultModel(providerOverride) });
  }
  if (modelOverride) updateConfig({ model: modelOverride });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('\n  TELEGRAM_BOT_TOKEN is not set.\n');
    console.error('  To set up Telegram integration:');
    console.error('  1. Open Telegram and message @BotFather');
    console.error('  2. Send /newbot and follow the prompts');
    console.error('  3. Copy the bot token');
    console.error('  4. Set it: export TELEGRAM_BOT_TOKEN="your-token"');
    console.error('     Or add to .env: TELEGRAM_BOT_TOKEN=your-token\n');
    process.exit(1);
  }

  await runStartupChecks();

  // Verify token works
  try {
    const me = await tgCall(token, 'getMe');
    const config = getConfig();
    console.log();
    console.log('  \x1b[36m\x1b[1m★ VKCoder Telegram Bot\x1b[0m');
    console.log(`  Bot: @${me.username}`);
    console.log(`  Model: ${config.model} (${config.provider})`);
    console.log();
    console.log(`  Message @${me.username} on Telegram to start coding.`);
    console.log('  Press Ctrl+C to stop.\n');
  } catch (err) {
    console.error('Invalid Telegram bot token:', err.message);
    process.exit(1);
  }

  // Start polling
  pollUpdates(token);
}
