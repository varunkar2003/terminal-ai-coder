import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

import { getConfig, updateConfig } from './config.js';
import { getProvider, getDefaultModel, isValidProvider } from './providers/router.js';
import { Conversation } from './context/conversation.js';
import { getProjectContext } from './context/project.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { runAgent } from './agent.js';

const AUTH_DIR = join(homedir(), '.vkcoder', 'whatsapp-auth');
const conversations = new Map();

// ─── Per-chat conversation ──────────────────────────────────────────────────

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

// ─── Message handler ────────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
  const text = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text;

  if (!text) return;

  const chatId = msg.key.remoteJid;
  const isFromMe = msg.key.fromMe;

  // Only respond to your own messages (self-chat) or DMs, not random group msgs
  if (!isFromMe && chatId.endsWith('@g.us')) return;

  // Commands
  if (text === '/clear') {
    conversations.delete(chatId);
    await sock.sendMessage(chatId, { text: 'Conversation cleared.' });
    return;
  }

  if (text === '/status') {
    const config = getConfig();
    await sock.sendMessage(chatId, {
      text: `VKCoder\nModel: ${config.model}\nProvider: ${config.provider}`,
    });
    return;
  }

  if (text.startsWith('/')) return;

  const conversation = getConversation(chatId);
  const config = getConfig();
  const provider = await getProvider();

  await sock.presenceSubscribe(chatId).catch(() => {});
  await sock.sendPresenceUpdate('composing', chatId).catch(() => {});

  const typingInterval = setInterval(() => {
    sock.sendPresenceUpdate('composing', chatId).catch(() => {});
  }, 4000);

  try {
    const toolSummary = [];

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
          const short = argsStr.length > 50 ? argsStr.substring(0, 50) + '...' : argsStr;
          toolSummary.push(`> ${name} ${short}`);
        },
        onToolResult(name, result) {
          const lines = result.split('\n');
          if (lines.length > 3) {
            toolSummary.push(`  ${lines.slice(0, 2).join('\n  ')}... (${lines.length} lines)`);
          }
        },
        onToolError(name, err) {
          toolSummary.push(`  Error: ${err.message}`);
        },
      },
    });

    clearInterval(typingInterval);
    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});

    if (toolSummary.length > 0) {
      await sock.sendMessage(chatId, { text: toolSummary.join('\n') });
    }

    if (result.fullText) {
      const chunks = [];
      for (let i = 0; i < result.fullText.length; i += 4000) {
        chunks.push(result.fullText.substring(i, i + 4000));
      }
      for (const chunk of chunks) {
        await sock.sendMessage(chatId, { text: chunk });
      }
    } else if (result.error) {
      await sock.sendMessage(chatId, { text: `Error: ${result.error}` });
    }

  } catch (err) {
    clearInterval(typingInterval);
    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});
    await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
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

export async function startWhatsApp(options = {}) {
  const { modelOverride, providerOverride } = options;

  if (providerOverride) {
    if (!isValidProvider(providerOverride)) {
      console.error(`Unknown provider: ${providerOverride}`);
      process.exit(1);
    }
    updateConfig({ provider: providerOverride, model: getDefaultModel(providerOverride) });
  }
  if (modelOverride) updateConfig({ model: modelOverride });

  await runStartupChecks();

  if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });

  const config = getConfig();
  console.log();
  console.log('  \x1b[36m\x1b[1m★ VKCoder WhatsApp Bot\x1b[0m');
  console.log(`  Model: ${config.model} (${config.provider})`);
  console.log();

  connectWhatsApp();
}

function connectWhatsApp() {
  useMultiFileAuthState(AUTH_DIR).then(({ state, saveCreds }) => {
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('VKCoder'),
      logger: {
        info() {}, warn() {}, error() {}, debug() {}, trace() {},
        child() { return this; }, level: 'silent',
      },
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('  Scan this QR code with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('  Open WhatsApp > Settings > Linked Devices > Link a Device\n');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('  Logged out. Delete ~/.vkcoder/whatsapp-auth/ and try again.');
          process.exit(0);
        }
        console.log('  Reconnecting...');
        setTimeout(() => connectWhatsApp(), 3000);
      }

      if (connection === 'open') {
        console.log('  \x1b[32m✓ Connected to WhatsApp!\x1b[0m');
        console.log('  Send yourself a message to chat with VKCoder.');
        console.log('  Commands: /clear (reset), /status (show model)');
        console.log('  Press Ctrl+C to stop.\n');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (msg.message?.reactionMessage) continue;
        handleMessage(sock, msg).catch(err => {
          console.error('Error handling message:', err.message);
        });
      }
    });
  });
}
