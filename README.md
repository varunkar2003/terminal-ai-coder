# VKCoder

Terminal AI coding assistant powered by local models via Ollama. No cloud APIs, no API keys — complete privacy.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ollama** — [ollama.ai](https://ollama.ai)

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
ollama pull qwen2.5-coder:7b   # or any model from the list below
vkcoder
```

To run without global linking:

```bash
node bin/starcode.js
```

## Usage

### Interactive Mode

```bash
vkcoder                          # Start the REPL
vkcoder --model qwen2.5-coder:7b  # Use a specific model
```

### Single Question Mode

```bash
vkcoder -q "How do I reverse a string in Python?"
```

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

## Model Recommendations

| Model | Size | Best For |
|-------|------|----------|
| `qwen2.5-coder:7b` | 4.7GB | **Recommended** — best chat and coding ability |
| `starcoder2:instruct` | 4.0GB | Good for following instructions |
| `starcoder2:7b` | 4.0GB | Balanced quality and speed |
| `starcoder2:3b` | 1.7GB | Low-resource machines (code completion only, not chat) |

> **Note:** `starcoder2:3b` is a code completion model, not a chat model. It may produce repetitive output. Use `qwen2.5-coder:7b` for the best experience.

Pull a model:

```bash
ollama pull qwen2.5-coder:7b
```

## Configuration

Create a `.vkcoder.json` in your project root to customize behavior:

```json
{
  "model": "qwen2.5-coder:7b",
  "temperature": 0.2,
  "ollamaHost": "http://localhost:11434",
  "contextWindow": 8192
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
- Shallow directory tree

## Troubleshooting

### "Cannot connect to Ollama"

Make sure Ollama is running:

```bash
ollama serve
```

### "Model not found"

Pull the model first:

```bash
ollama pull starcoder2:3b
```

### Slow responses

- Use a smaller model (`starcoder2:3b`)
- Ensure no other heavy processes are using GPU/CPU
- Check Ollama logs: `ollama logs`

## License

MIT
