import chalk from 'chalk';
import { getConfig, updateConfig } from './config.js';
import { checkOllamaHealth, checkModelAvailable, streamChat, listModels } from './model.js';
import { Conversation } from './context/conversation.js';
import { getProjectContext } from './context/project.js';
import { prompt, multiLinePrompt, confirm, closePrompt } from './ui/prompt.js';
import { startSpinner, stopSpinner, updateSpinner, succeedSpinner, failSpinner } from './ui/spinner.js';
import { renderMarkdown, renderError, renderSuccess, renderWarning, renderToolOutput, renderDivider, StreamRenderer } from './ui/renderer.js';
import { readFile, parseReadArgs } from './tools/fileReader.js';
import { writeFile, editFile, parseWriteArgs } from './tools/fileWriter.js';
import { runCommand } from './tools/executor.js';
import { globSearch } from './tools/globSearch.js';
import { grepSearch } from './tools/grepSearch.js';

const conversation = new Conversation();

async function startupChecks() {
  const config = getConfig();

  startSpinner('Checking Ollama connection...');
  const healthy = await checkOllamaHealth();
  if (!healthy) {
    failSpinner('Ollama is not running');
    renderError(`Cannot connect to Ollama at ${config.ollamaHost}`);
    renderWarning('Start Ollama with: ollama serve');
    process.exit(1);
  }
  succeedSpinner('Ollama connected');

  startSpinner(`Looking for model ${chalk.cyan(config.model)}...`);
  const available = await checkModelAvailable(config.model);
  if (!available) {
    failSpinner(`Model ${config.model} not found`);
    renderWarning(`Pull it with: ollama pull ${config.model}`);

    try {
      const models = await listModels();
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
}

function injectProjectContext() {
  const config = getConfig();
  const projectContext = getProjectContext();
  const fullSystemPrompt = `${config.systemPrompt}\n\n${projectContext}`;
  conversation.setSystemPrompt(fullSystemPrompt);
}

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
      console.log(chalk.gray('\nGoodbye! 👋'));
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

    case '/model':
      await handleModelCommand(args);
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
  ${chalk.yellow('/clear')}                             Clear conversation history
  ${chalk.yellow('/help')}                              Show this help
  ${chalk.yellow('/quit')}                              Exit VKCoder

${chalk.gray('Tip: Use triple backticks (\`\`\`) to enter multi-line input')}
`;
  console.log(help);
}

async function handleModelCommand(args) {
  if (!args) {
    const config = getConfig();
    console.log(`Current model: ${chalk.cyan(config.model)}`);
    try {
      const models = await listModels();
      console.log(chalk.gray('\nAvailable models:'));
      for (const m of models) {
        const marker = m.name === config.model ? chalk.green(' ← current') : '';
        console.log(`  ${chalk.white(m.name)}${marker}`);
      }
    } catch { /* ignore */ }
    return;
  }

  updateConfig({ model: args });
  renderSuccess(`Switched to model: ${args}`);
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
      if (!ok) {
        renderWarning('Cancelled');
        return;
      }
      const result = editFile(parsed.filePath, parsed.search, parsed.replace);
      renderSuccess(`Edited ${result.path}`);
    } else {
      const ok = await confirm(`Write to ${parsed.filePath}?`);
      if (!ok) {
        renderWarning('Cancelled');
        return;
      }
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
  if (!ok) {
    renderWarning('Cancelled');
    return;
  }

  startSpinner('Running command...');
  const result = runCommand(args);
  stopSpinner();

  if (result.success) {
    renderToolOutput(`$ ${args}`, result.output || '(no output)');
  } else {
    renderError(`Command failed (exit ${result.exitCode})`);
    if (result.output) {
      renderToolOutput(`$ ${args}`, result.output);
    }
  }
}

async function handleGlobCommand(args) {
  if (!args) {
    renderError('Usage: /glob <pattern>');
    return;
  }

  try {
    startSpinner('Searching files...');
    const result = await globSearch(args);
    stopSpinner();

    if (result.results.length === 0) {
      renderWarning(`No files matching: ${args}`);
      return;
    }

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
  if (!args) {
    renderError('Usage: /grep <pattern> [fileglob]');
    return;
  }

  const parts = args.split(/\s+/);
  const pattern = parts[0];
  const fileGlob = parts[1] || '**/*';

  try {
    startSpinner('Searching content...');
    const result = await grepSearch(pattern, fileGlob);
    stopSpinner();

    if (result.results.length === 0) {
      renderWarning(`No matches for: ${pattern}`);
      return;
    }

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

async function chat(userInput) {
  const config = getConfig();
  conversation.addUser(userInput);

  const startTime = Date.now();
  startSpinner(`Sending to ${chalk.cyan(config.model)}...`);
  const renderer = new StreamRenderer();

  try {
    const messages = conversation.getMessages();
    updateSpinner(`Waiting for ${chalk.cyan(config.model)} to respond...`);

    const stream = streamChat(messages);
    let firstToken = true;
    let tokenCount = 0;

    for await (const token of stream) {
      if (firstToken) {
        const waitTime = ((Date.now() - startTime) / 1000).toFixed(1);
        stopSpinner();
        console.log(chalk.gray(`  [${config.model} · first token in ${waitTime}s]`));
        console.log();
        firstToken = false;
      }
      tokenCount++;
      renderer.write(token);
    }

    renderer.end();

    // Store the full response in conversation
    const fullResponse = renderer.getFullText();
    conversation.addAssistant(fullResponse);

    // Stats line
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const tokensPerSec = (tokenCount / ((Date.now() - startTime) / 1000)).toFixed(1);
    console.log(chalk.gray(`  [${tokenCount} tokens · ${totalTime}s · ${tokensPerSec} tok/s]`));

    // Re-render with markdown formatting
    console.log();
    const formatted = renderMarkdown(fullResponse);
    process.stdout.write(formatted);
    console.log();
  } catch (err) {
    stopSpinner();
    renderer.end();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    renderError(`Chat error after ${elapsed}s: ${err.message || err}`);

    // Remove the failed user message
    conversation.messages.pop();
  }
}

async function handleSingleQuestion(question) {
  await startupChecks();
  injectProjectContext();
  console.log();
  await chat(question);
  process.exit(0);
}

export async function startRepl(options = {}) {
  const { modelOverride, singleQuestion } = options;

  if (modelOverride) {
    updateConfig({ model: modelOverride });
  }

  // Banner
  console.log();
  console.log(chalk.cyan.bold('  ★ VKCoder') + chalk.gray(' — Terminal AI Coding Assistant'));
  console.log(chalk.gray('  Powered by local models via Ollama'));
  renderDivider();
  console.log();

  if (singleQuestion) {
    await handleSingleQuestion(singleQuestion);
    return;
  }

  await startupChecks();
  injectProjectContext();

  console.log(chalk.gray('\n  Type /help for commands, /quit to exit\n'));

  // Ctrl+C handling
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nInterrupted. Type /quit to exit.'));
  });

  // Main REPL loop
  while (true) {
    try {
      let input = await prompt();

      if (!input || !input.trim()) continue;

      input = input.trim();

      // Multi-line mode
      if (input === '```') {
        input = await multiLinePrompt();
      }

      // Slash commands
      if (input.startsWith('/')) {
        await handleSlashCommand(input);
        continue;
      }

      // Chat
      await chat(input);
    } catch (err) {
      if (err.code === 'ERR_USE_AFTER_CLOSE') {
        break;
      }
      renderError(`Error: ${err.message}`);
    }
  }
}
