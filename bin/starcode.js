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
StarCode v${pkg.version} — Terminal AI Coding Assistant

Usage:
  starcode [options]

Options:
  --model <name>    Ollama model to use (default: starcoder2:3b)
  --help, -h        Show this help message
  --version, -v     Show version
  -q <question>     Ask a single question and exit

Slash Commands (inside REPL):
  /read <file> [--lines start-end]   Read a file
  /write <file> <content>            Write or edit a file
  /run <command>                     Run a shell command
  /glob <pattern>                    Search for files
  /grep <pattern> [glob]             Search file contents
  /context                           Show project context
  /model [name]                      Show or switch model
  /clear                             Clear conversation history
  /help                              Show help
  /quit                              Exit StarCode
`);
  process.exit(0);
}

// --version
if (args.includes('--version') || args.includes('-v')) {
  console.log(`StarCode v${pkg.version}`);
  process.exit(0);
}

// Parse --model
let modelOverride = null;
const modelIdx = args.indexOf('--model');
if (modelIdx !== -1 && args[modelIdx + 1]) {
  modelOverride = args[modelIdx + 1];
}

// Parse -q (single question mode)
let singleQuestion = null;
const qIdx = args.indexOf('-q');
if (qIdx !== -1 && args[qIdx + 1]) {
  singleQuestion = args.slice(qIdx + 1).join(' ');
}

// Launch the main app
const { startRepl } = await import('../src/index.js');
startRepl({ modelOverride, singleQuestion });
