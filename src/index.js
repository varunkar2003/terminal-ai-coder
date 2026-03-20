import chalk from 'chalk';
import { getConfig, updateConfig } from './config.js';
import { getProvider, getDefaultModel, isValidProvider, getProviderNames, getKeyEnvVar } from './providers/router.js';
import { Conversation } from './context/conversation.js';
import { getProjectContext } from './context/project.js';
import { prompt, multiLinePrompt, confirm, closePrompt } from './ui/prompt.js';
import { startSpinner, stopSpinner, updateSpinner, succeedSpinner, failSpinner } from './ui/spinner.js';
import { renderError, renderSuccess, renderWarning, renderToolOutput, renderDivider } from './ui/renderer.js';
import { readFile, parseReadArgs } from './tools/fileReader.js';
import { writeFile, editFile, parseWriteArgs } from './tools/fileWriter.js';
import { runCommand } from './tools/executor.js';
import { globSearch } from './tools/globSearch.js';
import { grepSearch } from './tools/grepSearch.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { runAgent } from './agent.js';
import { memoryList } from './tools/memory.js';

const conversation = new Conversation();

// Cumulative token usage tracking
const sessionUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

const MAX_TOOL_ROUNDS = 15;
let globalAutoApprove = false;

async function startupChecks() {
  const config = getConfig();
  const provider = await getProvider();

  startSpinner(`Checking ${provider.getProviderName()} connection...`);
  const health = await provider.checkHealth();
  if (!health.ok) {
    failSpinner(`${provider.getProviderName()} not available`);
    renderError(health.error);
    if (config.provider === 'ollama') {
      renderWarning('Start Ollama with: ollama serve');
    }
    process.exit(1);
  }
  succeedSpinner(`${provider.getProviderName()} connected`);

  if (config.provider === 'ollama') {
    const { checkModelAvailable } = await import('./providers/ollama.js');
    startSpinner(`Looking for model ${chalk.cyan(config.model)}...`);
    const available = await checkModelAvailable(config.model);
    if (!available) {
      failSpinner(`Model ${config.model} not found`);
      renderWarning(`Pull it with: ollama pull ${config.model}`);

      try {
        const models = await provider.listModels();
        if (models.length > 0) {
          console.log(chalk.gray('\nAvailable models:'));
          for (const m of models) {
            console.log(chalk.gray(`  - ${m.name}`));
          }
        }
      } catch { /* ignore */ }

      process.exit(1);
    }
    succeedSpinner(`Model ${config.model} ready (context: ${config.contextWindow} tokens)`);
  } else {
    succeedSpinner(`Using model ${chalk.cyan(config.model)}`);
  }
}

function injectProjectContext() {
  const config = getConfig();
  const projectContext = getProjectContext();
  const memories = memoryList();
  const memorySection = memories !== 'No memories stored yet.'
    ? `\n\nUser memories:\n${memories}`
    : '';
  const fullSystemPrompt = `${config.systemPrompt}\n\n${projectContext}${memorySection}`;
  conversation.setSystemPrompt(fullSystemPrompt);
}

// ─── Slash Commands ─────────────────────────────────────────────────────────

async function handleSlashCommand(input) {
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = input.substring(command.length).trim();

  switch (command) {
    case '/help':
      showHelp();
      return true;

    case '/quit':
    case '/exit':
      console.log(chalk.gray('\nGoodbye!'));
      closePrompt();
      process.exit(0);

    case '/clear':
      conversation.clear();
      injectProjectContext();
      renderSuccess('Conversation cleared');
      return true;

    case '/context': {
      const ctx = getProjectContext();
      const tokens = conversation.getTokenEstimate();
      const msgs = conversation.length;
      renderToolOutput('Project Context', ctx);
      console.log(chalk.gray(`  Conversation: ${msgs} messages, ~${tokens} tokens used\n`));
      return true;
    }

    case '/history':
      await handleHistoryCommand(args);
      return true;

    case '/model':
      await handleModelCommand(args);
      return true;

    case '/provider':
      await handleProviderCommand(args);
      return true;

    case '/read':
      await handleReadCommand(args);
      return true;

    case '/write':
      await handleWriteCommand(args);
      return true;

    case '/run':
      await handleRunCommand(args);
      return true;

    case '/glob':
      await handleGlobCommand(args);
      return true;

    case '/grep':
      await handleGrepCommand(args);
      return true;

    default:
      renderError(`Unknown command: ${command}. Type /help for available commands.`);
      return true;
  }
}

function showHelp() {
  const help = `
${chalk.cyan.bold('VKCoder Commands')}

  ${chalk.yellow('/read')} <file> [--lines start-end]   Read a file
  ${chalk.yellow('/write')} <file> <content>            Write content to a file
  ${chalk.yellow('/write')} <file> --edit <search> --- <replace>
                                       Edit a file (search & replace)
  ${chalk.yellow('/run')} <command>                     Run a shell command
  ${chalk.yellow('/glob')} <pattern>                    Search for files by pattern
  ${chalk.yellow('/grep')} <pattern> [fileglob]         Search file contents
  ${chalk.yellow('/context')}                           Show project context
  ${chalk.yellow('/model')} [name]                      Show or switch model
  ${chalk.yellow('/provider')} [name]                   Show or switch provider
  ${chalk.yellow('/history')} [clear]                   Show or clear history
  ${chalk.yellow('/clear')}                             Clear conversation history
  ${chalk.yellow('/help')}                              Show this help
  ${chalk.yellow('/quit')}                              Exit VKCoder

${chalk.gray('Tip: Use triple backticks (\\`\\`\\`) to enter multi-line input')}
${chalk.gray('The AI can use tools autonomously — just ask it to read, write, or run commands.')}
`;
  console.log(help);
}

async function handleHistoryCommand(args) {
  if (args === 'clear') {
    conversation.clear();
    injectProjectContext();
    renderSuccess('Conversation history cleared');
    return;
  }

  const msgs = conversation.length;
  const tokens = conversation.getTokenEstimate();
  console.log(`\n  ${chalk.cyan('Conversation:')} ${msgs} messages, ~${tokens} tokens`);

  if (msgs > 0) {
    console.log(chalk.gray('\n  Recent messages:'));
    const messages = conversation.getMessages().filter(m => m.role !== 'system');
    const recent = messages.slice(-6);
    for (const msg of recent) {
      const role = msg.role === 'user'
        ? chalk.green('You')
        : msg.role === 'assistant'
          ? chalk.cyan('AI')
          : chalk.yellow(msg.role);
      const preview = (msg.content || '(tool call)').substring(0, 80).replace(/\n/g, ' ');
      console.log(`  ${role}: ${chalk.gray(preview)}${(msg.content || '').length > 80 ? '...' : ''}`);
    }
  }
  console.log(chalk.gray(`\n  Use ${chalk.yellow('/history clear')} to clear\n`));
}

async function handleModelCommand(args) {
  const provider = await getProvider();

  if (!args) {
    const config = getConfig();
    console.log(`Current model: ${chalk.cyan(config.model)} (${provider.getProviderName()})`);
    try {
      const models = await provider.listModels();
      console.log(chalk.gray('\nAvailable models:'));
      for (const m of models) {
        const marker = m.name === config.model ? chalk.green(' <- current') : '';
        const desc = m.description ? chalk.gray(` — ${m.description}`) : '';
        console.log(`  ${chalk.white(m.name)}${desc}${marker}`);
      }
    } catch { /* ignore */ }
    return;
  }

  updateConfig({ model: args });
  renderSuccess(`Switched to model: ${args}`);
}

async function handleProviderCommand(args) {
  const config = getConfig();

  if (!args) {
    const provider = await getProvider();
    console.log(`Current provider: ${chalk.cyan(provider.getProviderName())} (${config.provider})`);
    console.log(`Current model: ${chalk.cyan(config.model)}`);
    console.log(chalk.gray('\nAvailable providers:'));

    for (const name of getProviderNames()) {
      const isCurrent = name === config.provider;
      const marker = isCurrent ? chalk.green(' <- current') : '';
      const envVar = getKeyEnvVar(name);
      let keyStatus = '';
      if (envVar) {
        keyStatus = process.env[envVar]
          ? chalk.green(' (key set)')
          : chalk.yellow(' (key missing)');
      }
      console.log(`  ${chalk.white(name)}${keyStatus}${marker}`);
    }
    return;
  }

  const newProvider = args.toLowerCase();
  if (!isValidProvider(newProvider)) {
    renderError(`Unknown provider: ${args}. Valid providers: ${getProviderNames().join(', ')}`);
    return;
  }

  const defaultModel = getDefaultModel(newProvider);
  updateConfig({ provider: newProvider, model: defaultModel });

  const provider = await getProvider(newProvider);
  const health = await provider.checkHealth();
  if (!health.ok) {
    renderWarning(health.error);
  }

  renderSuccess(`Switched to ${provider.getProviderName()} with model ${defaultModel}`);
}

async function handleReadCommand(args) {
  if (!args) {
    renderError('Usage: /read <file> [--lines start-end]');
    return;
  }

  try {
    const { filePath, lines } = parseReadArgs(args);
    const result = readFile(filePath, { lines });
    const header = lines
      ? `${filePath} (lines ${result.lineRange} of ${result.total})`
      : `${filePath} (${result.total} lines)`;
    renderToolOutput(header, result.content);
  } catch (err) {
    renderError(err.message);
  }
}

async function handleWriteCommand(args) {
  if (!args) {
    renderError('Usage: /write <file> <content>  or  /write <file> --edit <search> --- <replace>');
    return;
  }

  try {
    const parsed = parseWriteArgs(args);
    if (parsed.mode === 'edit') {
      const ok = await confirm(`Edit ${parsed.filePath}?`);
      if (!ok) { renderWarning('Cancelled'); return; }
      const result = editFile(parsed.filePath, parsed.search, parsed.replace);
      renderSuccess(`Edited ${result.path}`);
    } else {
      const ok = await confirm(`Write to ${parsed.filePath}?`);
      if (!ok) { renderWarning('Cancelled'); return; }
      const result = writeFile(parsed.filePath, parsed.content);
      renderSuccess(`Created ${result.path} (${result.size} bytes)`);
    }
  } catch (err) {
    renderError(err.message);
  }
}

async function handleRunCommand(args) {
  if (!args) {
    renderError('Usage: /run <command>');
    return;
  }

  const ok = await confirm(`Run: ${chalk.yellow(args)}?`);
  if (!ok) { renderWarning('Cancelled'); return; }

  startSpinner('Running command...');
  const result = runCommand(args);
  stopSpinner();

  if (result.success) {
    renderToolOutput(`$ ${args}`, result.output || '(no output)');
  } else {
    renderError(`Command failed (exit ${result.exitCode})`);
    if (result.output) renderToolOutput(`$ ${args}`, result.output);
  }
}

async function handleGlobCommand(args) {
  if (!args) { renderError('Usage: /glob <pattern>'); return; }

  try {
    startSpinner('Searching files...');
    const result = await globSearch(args);
    stopSpinner();
    if (result.results.length === 0) { renderWarning(`No files matching: ${args}`); return; }
    const output = result.results.join('\n');
    const header = result.truncated
      ? `Files matching "${args}" (showing ${result.results.length} of ${result.total})`
      : `Files matching "${args}" (${result.total} results)`;
    renderToolOutput(header, output);
  } catch (err) {
    stopSpinner();
    renderError(err.message);
  }
}

async function handleGrepCommand(args) {
  if (!args) { renderError('Usage: /grep <pattern> [fileglob]'); return; }

  const parts = args.split(/\s+/);
  const pattern = parts[0];
  const fileGlob = parts[1] || '**/*';

  try {
    startSpinner('Searching content...');
    const result = await grepSearch(pattern, fileGlob);
    stopSpinner();
    if (result.results.length === 0) { renderWarning(`No matches for: ${pattern}`); return; }
    const output = result.results
      .map(r => `${chalk.cyan(r.file)}:${chalk.yellow(r.line)}: ${r.content}`)
      .join('\n');
    const header = result.truncated
      ? `Matches for "${pattern}" (showing ${result.results.length}, more exist)`
      : `Matches for "${pattern}" (${result.total} results)`;
    renderToolOutput(header, output);
  } catch (err) {
    stopSpinner();
    renderError(err.message);
  }
}

// ─── Chat (using agent core) ───────────────────────────────────────────────

function renderToolCallInfo(name, args) {
  const argsPreview = typeof args === 'string' ? args : JSON.stringify(args);
  const short = argsPreview.length > 100 ? argsPreview.substring(0, 100) + '...' : argsPreview;
  console.log(`\n${chalk.magenta('>')} ${chalk.magenta.bold(name)} ${chalk.gray(short)}`);
}

function renderToolResultInfo(name, result) {
  const lines = result.split('\n');
  const preview = lines.length > 8
    ? lines.slice(0, 8).join('\n') + `\n${chalk.gray(`... (${lines.length} lines total)`)}`
    : result;
  console.log(`${chalk.gray(preview)}`);
}

async function chat(userInput) {
  const config = getConfig();
  const provider = await getProvider();

  await runAgent(userInput, {
    conversation,
    provider,
    config,
    tools: TOOL_DEFINITIONS,
    autoApprove: globalAutoApprove,
    maxRounds: MAX_TOOL_ROUNDS,
    callbacks: {
      onSpinner(text) { startSpinner(text); },
      onSpinnerStop() { stopSpinner(); },
      onFirstToken(meta) {
        console.log(chalk.gray(`  [${meta.model} · first token in ${meta.waitTime}s]`));
        console.log();
      },
      onToken(text) {
        process.stdout.write(text);
      },
      onResponseDone(meta) {
        process.stdout.write('\n');
        if (meta.tokenCount > 0) {
          console.log(chalk.gray(`\n  [${meta.tokenCount} chunks · ${meta.totalTime}s · ${meta.tokensPerSec.toFixed(1)} chunks/s]`));
        }
        if (meta.usage) {
          sessionUsage.prompt_tokens += meta.usage.prompt_tokens;
          sessionUsage.completion_tokens += meta.usage.completion_tokens;
          sessionUsage.total_tokens += meta.usage.total_tokens;
          console.log(chalk.gray(`  [tokens: ${meta.usage.prompt_tokens} in + ${meta.usage.completion_tokens} out = ${meta.usage.total_tokens} · session: ${sessionUsage.total_tokens}]`));
        }
        console.log();
      },
      onToolCall(name, args) {
        renderToolCallInfo(name, args);
      },
      onToolResult(name, result) {
        renderToolResultInfo(name, result);
      },
      onToolError(name, err) {
        console.log(chalk.red(`  Error in ${name}: ${err.message}`));
      },
      onError(err) {
        renderError(`Chat error: ${err.message || err}`);
      },
      onMaxRounds() {
        renderWarning(`Stopped after ${MAX_TOOL_ROUNDS} tool rounds.`);
      },
    },
  });
}

// ─── REPL ───────────────────────────────────────────────────────────────────

async function handleSingleQuestion(question) {
  await startupChecks();
  injectProjectContext();
  console.log();
  await chat(question);
  process.exit(0);
}

export async function startRepl(options = {}) {
  const { modelOverride, providerOverride, singleQuestion, autoApprove } = options;

  if (autoApprove) {
    globalAutoApprove = true;
  }

  if (providerOverride) {
    if (!isValidProvider(providerOverride)) {
      renderError(`Unknown provider: ${providerOverride}. Valid providers: ${getProviderNames().join(', ')}`);
      process.exit(1);
    }
    const defaultModel = getDefaultModel(providerOverride);
    updateConfig({ provider: providerOverride, model: defaultModel });
  }

  if (modelOverride) {
    updateConfig({ model: modelOverride });
  }

  // Banner
  const config = getConfig();
  const provider = await getProvider();
  console.log();
  console.log(chalk.cyan.bold('  ★ VKCoder') + chalk.gray(' — Terminal AI Coding Assistant'));
  console.log(chalk.gray(`  Powered by ${provider.getProviderName()}`));
  renderDivider();
  console.log();

  if (singleQuestion) {
    await handleSingleQuestion(singleQuestion);
    return;
  }

  await startupChecks();

  // Pre-warm the model
  const config2 = getConfig();
  if (config2.provider === 'ollama') {
    try {
      const warmupProvider = await getProvider();
      const warmup = warmupProvider.streamChat([{role:'user', content:'hi'}], {});
      for await (const _ of warmup) { break; } // read one token then stop
    } catch {}
  }

  injectProjectContext();

  // Load previous conversation
  conversation.load();
  if (conversation.length > 0) {
    console.log(chalk.gray(`\n  Restored ${conversation.length} messages from previous session`));
    console.log(chalk.gray(`  Use /clear to start fresh`));
  }

  console.log(chalk.gray('\n  Type /help for commands, /quit to exit\n'));

  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nInterrupted. Type /quit to exit.'));
  });

  // Main REPL loop
  while (true) {
    try {
      let input = await prompt();
      if (!input || !input.trim()) continue;
      input = input.trim();

      if (input === '```') {
        input = await multiLinePrompt();
      }

      if (input.startsWith('/')) {
        await handleSlashCommand(input);
        continue;
      }

      await chat(input);
    } catch (err) {
      if (err.code === 'ERR_USE_AFTER_CLOSE') break;
      renderError(`Error: ${err.message}`);
    }
  }
}
