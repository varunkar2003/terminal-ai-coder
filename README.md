# VKCoder

Agentic AI coding assistant with **autonomous tool use**. Works with local models via Ollama or cloud APIs (OpenAI, Anthropic, Google Gemini).

The AI can read files, write code, run commands, and search your project — all on its own. Just describe what you want. Access from your **terminal** or **phone** (via built-in web server).

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ollama** (for local models) — [ollama.ai](https://ollama.ai)

## Quick Start (Automatic)

```bash
git clone https://github.com/varunkar2003/terminal-ai-coder.git
cd terminal-ai-coder
bash setup.sh
vkcoder
```

The setup script checks prerequisites, lets you pick a model, installs dependencies, and links the `vkcoder` command globally.

## Manual Installation

If you prefer to set things up yourself:

```bash
git clone https://github.com/varunkar2003/terminal-ai-coder.git
cd terminal-ai-coder
npm install
npm link          # makes 'vkcoder' available globally
ollama pull qwen3.5:4b   # or any model from the list below
vkcoder
```

To run without global linking:

```bash
node bin/starcode.js
```

## Usage

### Interactive Mode

```bash
vkcoder                          # Start with Ollama (default: qwen3.5:4b)
vkcoder --model qwen2.5-coder:7b  # Use a specific model
vkcoder --provider openai        # Use OpenAI API
vkcoder --provider anthropic     # Use Anthropic API
vkcoder --provider gemini        # Use Google Gemini API
```

### Single Question Mode

```bash
vkcoder -q "How do I reverse a string in Python?"
vkcoder --provider openai -q "Explain async/await in JavaScript"
```

### Autonomous Tool Use

The AI can use tools on its own — just ask naturally:

```
vkcoder> Read the main config file and tell me what it does
vkcoder> Find all TODO comments in the project
vkcoder> Add error handling to the login function in src/auth.js
vkcoder> Run the tests and fix any failures
```

The AI will read files, search code, write changes, and run commands as needed. It asks for confirmation before writes and command execution.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/read <file> [--lines 1-50]` | Read a file with line numbers |
| `/write <file> <content>` | Create or overwrite a file |
| `/write <file> --edit <search> --- <replace>` | Search and replace in a file |
| `/run <command>` | Run a shell command (with confirmation) |
| `/glob <pattern>` | Search for files by glob pattern |
| `/grep <pattern> [fileglob]` | Search file contents with regex |
| `/context` | Show detected project context |
| `/model [name]` | Show or switch the active model |
| `/provider [name]` | Show or switch the API provider |
| `/history [clear]` | Show or clear conversation history |
| `/clear` | Clear conversation history |
| `/help` | Show available commands |
| `/quit` | Exit VKCoder |

### Multi-line Input

Start a line with triple backticks to enter multi-line mode:

```
vkcoder> ```
  (multi-line mode — enter ``` to finish)
... function hello() {
...   return "world";
... }
... ```
```

## API Providers

VKCoder supports four providers. Ollama runs locally; the others require an API key set as an environment variable.

| Provider | Flag | Env Variable | Default Model |
|----------|------|-------------|---------------|
| Ollama | `--provider ollama` | — | `qwen3.5:4b` |
| OpenAI | `--provider openai` | `OPENAI_API_KEY` | `gpt-4o` |
| Anthropic | `--provider anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Google Gemini | `--provider gemini` | `GOOGLE_API_KEY` | `gemini-2.0-flash` |

### Setting API Keys

Export the key for the provider you want to use:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AI..."
```

Or pass it inline for a single session:

```bash
OPENAI_API_KEY="sk-..." vkcoder --provider openai
```

You can also add keys to a `.env` file in the project root (already in `.gitignore`):

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
```

VKCoder automatically loads `.env` files at startup.

### Switching Providers at Runtime

Use the `/provider` command inside the REPL:

```
vkcoder> /provider
Current provider: Ollama (local) (ollama)
Current model: qwen3.5:4b

Available providers:
  ollama (key set) <- current
  openai (key set)
  anthropic (key missing)
  gemini (key missing)

vkcoder> /provider openai
✔ Switched to OpenAI with model gpt-4o

vkcoder> /model gpt-4-turbo
✔ Switched to model: gpt-4-turbo
```

### Available Models

**OpenAI:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`

**Anthropic:** `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-haiku-35-20241022`

**Google Gemini:** `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`

**Ollama:** Any model you've pulled — run `ollama list` to see installed models.

## Ollama Model Recommendations

| Model | Size | Best For |
|-------|------|----------|
| `qwen3.5:4b` | 3.4GB | **Recommended** — strong coding + tool use support |
| `qwen2.5-coder:7b` | 4.7GB | Strong general coding |
| `starcoder2:7b` | 4.0GB | Balanced quality and speed |
| `starcoder2:3b` | 1.7GB | Low-resource machines (code completion only, not chat) |

> **Note:** `starcoder2:3b` is a code completion model, not a chat model. It may produce repetitive output. Use `qwen3.5:4b` for the best experience.

Pull a model:

```bash
ollama pull qwen3.5:4b
```

## Phone / Remote Access

Run VKCoder as a web server and access it from any device on your network:

```bash
vkcoder --serve                    # Start on port 3456
vkcoder --serve --port 8080        # Custom port
vkcoder --serve --provider openai  # Use cloud API
```

Open the **Network URL** (printed on startup) on your phone's browser. The web UI is mobile-optimized with:
- Dark theme chat interface
- Streaming responses
- Live tool call visualization
- Touch-friendly input

Your Mac runs Ollama + VKCoder locally. Your phone just connects via WiFi — no cloud required.

## Features

- **Agentic AI** — Plans, explores, executes, and verifies autonomously
- **Autonomous tool use** — Reads files, writes code, runs commands, searches your project
- **Phone access** — Built-in web server with mobile-friendly UI
- **Multi-provider** — Ollama (local), OpenAI, Anthropic, Google Gemini
- **Small model optimized** — Text-based tool call fallback for models without native function calling
- **Auto-context** — Detects file paths in your message and loads them automatically
- **Self-correction** — Retries with different approaches when tools fail
- **Streaming responses** — See output as it's generated
- **Conversation persistence** — Sessions saved/restored automatically
- **Command history** — Arrow-key recall across sessions (`~/.vkcoder/`)
- **Project context** — Auto-detects project type, dependencies, structure
- **.env loading** — API keys loaded from `.env` files automatically
- **Cross-platform** — Works on macOS, Linux, and Windows

## Configuration

Create a `.vkcoder.json` in your project root to customize behavior:

```json
{
  "provider": "ollama",
  "model": "qwen3.5:4b",
  "temperature": 0.2,
  "ollamaHost": "http://localhost:11434",
  "contextWindow": 32768
}
```

### Custom Modelfile

Use the included `Modelfile` for optimized coding parameters:

```bash
ollama create vkcoder -f Modelfile
vkcoder --model vkcoder
```

## VS Code Integration

The `.vscode/` directory includes:

- **tasks.json** — Launch VKCoder via `Ctrl+Shift+P` → "Run Task" → "VKCoder: Launch"
- **settings.json** — Terminal profile for VKCoder (click the dropdown arrow in the terminal panel)

## Project Context

VKCoder automatically detects your project type and provides context to the model:

- **Node.js** — reads `package.json` (name, deps, scripts)
- **Python** — detects `requirements.txt` or `pyproject.toml`
- **Rust** — detects `Cargo.toml`
- **Go** — detects `go.mod`
- Git branch detection
- Directory tree structure

## Troubleshooting

### "Cannot connect to Ollama"

Make sure Ollama is running:

```bash
ollama serve
```

### "Model not found"

Pull the model first:

```bash
ollama pull qwen3.5:4b
```

### "API key not set"

Export the key for your provider:

```bash
export OPENAI_API_KEY="sk-..."
```

Or add it to a `.env` file in your project root. Check status with `/provider` inside the REPL.

### Slow responses

- Use a smaller model (`starcoder2:3b` for Ollama, `gpt-4o-mini` for OpenAI)
- Ensure no other heavy processes are using GPU/CPU
- Check Ollama logs: `ollama logs`

## License

MIT
