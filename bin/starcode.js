#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  /clear                             Clear conversation history
  /help                              Show help
  /quit                              Exit VKCoder
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

// Parse -q (single question mode)
let singleQuestion = null;
const qIdx = args.indexOf('-q');
if (qIdx !== -1 && args[qIdx + 1]) {
  singleQuestion = args.slice(qIdx + 1).join(' ');
}

// Launch the main app
const { startRepl } = await import('../src/index.js');
startRepl({ modelOverride, providerOverride, singleQuestion });
