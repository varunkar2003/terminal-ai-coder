#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Load .env file if present ──────────────────────────────────
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch { /* ignore */ }
}

// ─── CLI ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const args = process.argv.slice(2);

// --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
VKCoder v${pkg.version} — Terminal AI Coding Assistant

Usage:
  vkcoder [options]

Options:
  --model <name>      Model to use (default depends on provider)
  --provider <name>   API provider: ollama, openai, anthropic, gemini
  --serve             Start web server (access from phone/browser)
  --whatsapp          Start WhatsApp bot (scan QR to connect)
  --telegram          Start Telegram bot mode
  --auto              Auto-approve all tool calls (no confirmations)
  --port <number>     Port for web server (default: 3456)
  --help, -h          Show this help message
  --version, -v       Show version
  -q <question>       Ask a single question and exit

Providers:
  ollama      Local models via Ollama (default)
  openai      OpenAI API (set OPENAI_API_KEY)
  anthropic   Anthropic API (set ANTHROPIC_API_KEY)
  gemini      Google Gemini API (set GOOGLE_API_KEY)

Slash Commands (inside REPL):
  /read <file> [--lines start-end]   Read a file
  /write <file> <content>            Write or edit a file
  /run <command>                     Run a shell command
  /glob <pattern>                    Search for files
  /grep <pattern> [glob]             Search file contents
  /context                           Show project context
  /model [name]                      Show or switch model
  /provider [name]                   Show or switch provider
  /history [clear]                   Show or clear history
  /clear                             Clear conversation history
  /help                              Show help
  /quit                              Exit VKCoder

Modes:
  vkcoder --serve                    Start web UI on port 3456
  vkcoder --serve --port 8080        Start on custom port
  vkcoder --whatsapp                 Start WhatsApp bot (scan QR)
  vkcoder --telegram                 Start Telegram bot
  vkcoder --auto                     Full automation (no confirmations)
  Open the network URL on your phone to code remotely.
`);
  process.exit(0);
}

// --version
if (args.includes('--version') || args.includes('-v')) {
  console.log(`VKCoder v${pkg.version}`);
  process.exit(0);
}

// Parse --model
let modelOverride = null;
const modelIdx = args.indexOf('--model');
if (modelIdx !== -1 && args[modelIdx + 1]) {
  modelOverride = args[modelIdx + 1];
}

// Parse --provider
let providerOverride = null;
const providerIdx = args.indexOf('--provider');
if (providerIdx !== -1 && args[providerIdx + 1]) {
  providerOverride = args[providerIdx + 1];
}

// Parse --serve, --telegram, --auto
const serveMode = args.includes('--serve');
const telegramMode = args.includes('--telegram');
const whatsappMode = args.includes('--whatsapp');
const autoApprove = args.includes('--auto');

// Parse --port
let port = 3456;
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
  port = parseInt(args[portIdx + 1], 10);
}

// Parse -q (single question mode)
let singleQuestion = null;
const qIdx = args.indexOf('-q');
if (qIdx !== -1 && args[qIdx + 1]) {
  singleQuestion = args.slice(qIdx + 1).join(' ');
}

// Launch
if (whatsappMode) {
  const { startWhatsApp } = await import('../src/whatsapp.js');
  startWhatsApp({ modelOverride, providerOverride });
} else if (telegramMode) {
  const { startTelegram } = await import('../src/telegram.js');
  startTelegram({ modelOverride, providerOverride });
} else if (serveMode) {
  const { startServer } = await import('../src/server.js');
  startServer({ port, modelOverride, providerOverride });
} else {
  const { startRepl } = await import('../src/index.js');
  startRepl({ modelOverride, providerOverride, singleQuestion, autoApprove });
}
