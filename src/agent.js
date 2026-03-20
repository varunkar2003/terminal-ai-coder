import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { executeTool } from './tools/dispatcher.js';
import { loadPlugins } from './tools/plugins.js';
import { getSentimentPrompt } from './tools/sentiment.js';
import { shouldReduceLoad } from './tools/hardware.js';

const MAX_ROUNDS_DEFAULT = 20;

// ─── Response cache ──────────────────────────────────────────────────────────
const responseCache = new Map();
const MAX_CACHE_SIZE = 50;

function getCacheKey(input) {
  // Simple hash
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return h.toString();
}
const FORCE_ANSWER_AFTER = 12; // stop sending tools after this many rounds

// Load plugins on first use
let pluginTools = null;
async function getAllTools() {
  if (pluginTools === null) {
    const { tools } = await loadPlugins();
    pluginTools = tools;
    if (tools.length > 0) {
      console.log(`  Loaded ${tools.length} plugin(s)`);
    }
  }
  return [...TOOL_DEFINITIONS, ...pluginTools];
}

// ─── Smart tool selection — pick relevant tools based on user input ─────────

const TOOL_GROUPS = {
  core: ['read_file', 'write_file', 'edit_file', 'run_command', 'glob_search', 'grep_search', 'undo_last', 'undo_history', 'create_project'],
  web: ['web_search', 'web_fetch'],
  browser: ['browser_navigate', 'browser_get_text', 'browser_get_links', 'browser_get_inputs', 'browser_click', 'browser_type', 'browser_submit', 'browser_screenshot'],
  memory: ['memory_set', 'memory_get', 'memory_list', 'learn_code_patterns'],
  mac: ['mac_run_applescript', 'mac_open_app', 'mac_notification', 'capture_screen'],
  git: ['git_status', 'git_diff', 'git_log', 'git_commit', 'git_push'],
  scheduler: ['schedule_task', 'list_scheduled_tasks', 'cancel_scheduled_task', 'watch_files', 'get_file_changes'],
  agent: ['spawn_agent'],
  deploy: ['deploy'],
  database: ['db_query', 'db_describe'],
  apitest: ['test_api', 'health_check'],
  timetravel: ['file_history', 'file_at_commit', 'find_bug_commit', 'what_changed', 'git_blame'],
  selfevolve: ['create_tool'],
  knowledge: ['save_knowledge', 'get_knowledge', 'learn_from_project'],
  reverseeng: ['analyze_website'],
  blockchain: ['blockchain_balance', 'blockchain_tx', 'blockchain_gas'],
  modelswap: ['switch_model', 'auto_select_model'],
  procmanager: ['start_process', 'stop_process', 'process_logs', 'list_processes'],
  pentest: ['security_scan'],
  hardware: ['system_info', 'resource_usage'],
};

const GROUP_KEYWORDS = {
  web: ['search', 'google', 'find online', 'look up', 'internet', 'web', 'latest', 'current', 'news'],
  browser: ['open', 'go to', 'navigate', 'website', 'click', 'fill', 'form', 'book', 'booking', 'buy', 'login', 'sign', 'ticket', 'hotel', 'flight', 'amazon', 'irctc', 'browse', 'scrape'],
  memory: ['remember', 'forget', 'recall', 'preference', 'always', 'my name', 'i like', 'i prefer', 'i use', 'learn my', 'my style', 'my pattern'],
  mac: ['open app', 'spotify', 'music', 'finder', 'notification', 'notify', 'clipboard', 'applescript', 'vscode', 'terminal', 'screenshot', 'screen'],
  git: ['git', 'commit', 'push', 'pull', 'branch', 'diff', 'log', 'changes', 'version control'],
  scheduler: ['schedule', 'every', 'monitor', 'check every', 'cron', 'interval', 'periodic', 'recurring', 'watch'],
  agent: ['parallel', 'multiple', 'sub-task', 'break down', 'full-stack', 'complex project', 'build me', 'create entire', 'autonomous'],
  deploy: ['deploy', 'vercel', 'netlify', 'ship', 'launch', 'production', 'hosting', 'publish'],
  database: ['database', 'sqlite', 'sql', 'query', 'table', 'select', 'insert', 'schema', 'db', 'postgres'],
  apitest: ['test api', 'endpoint', 'health check', 'http test', 'api test', 'postman', 'curl'],
  timetravel: ['history', 'blame', 'who changed', 'when did', 'what broke', 'regression', 'bisect', 'time travel', 'old version', 'previous version', 'revert', 'what changed'],
  selfevolve: ['create tool', 'new tool', 'make a tool', 'custom tool', 'extend', 'self', 'evolve'],
  knowledge: ['knowledge', 'learn from', 'what do you know', 'remember project', 'cross project'],
  reverseeng: ['reverse engineer', 'clone', 'analyze site', 'what tech', 'tech stack', 'built with'],
  blockchain: ['blockchain', 'crypto', 'ethereum', 'wallet', 'balance', 'transaction', 'gas', 'solidity', 'smart contract', 'web3', 'nft'],
  modelswap: ['switch model', 'change model', 'bigger model', 'smaller model', 'faster model', 'better model'],
  procmanager: ['start server', 'run server', 'background', 'process', 'keep running', 'daemon', 'pm2', 'restart'],
  pentest: ['security', 'pentest', 'vulnerability', 'scan', 'hack', 'injection', 'xss', 'cors', 'ssl'],
  hardware: ['cpu', 'memory', 'ram', 'disk', 'battery', 'system info', 'hardware', 'performance', 'load', 'temperature'],
};

function selectToolsForInput(allTools, userInput) {
  const lower = userInput.toLowerCase();

  // Always include core tools
  const selectedNames = new Set(TOOL_GROUPS.core);

  // Add groups based on keyword matches
  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      for (const name of TOOL_GROUPS[group]) {
        selectedNames.add(name);
      }
    }
  }

  // If user mentions a URL, add web+browser
  if (lower.match(/https?:\/\/|www\.|\.com|\.org|\.io|\.dev/)) {
    for (const name of [...TOOL_GROUPS.web, ...TOOL_GROUPS.browser]) {
      selectedNames.add(name);
    }
  }

  // Filter tools to only selected ones
  const selected = allTools.filter(t => selectedNames.has(t.function.name));

  // If somehow very few tools selected, return all (failsafe)
  if (selected.length < 6) return allTools;

  return selected;
}

// ─── Text-based tool call parser (fallback for models without native function calling) ───

function parseTextToolCalls(text) {
  const results = [];
  const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name) {
        results.push({
          id: `text_${Date.now()}_${results.length}`,
          type: 'function',
          function: {
            name: parsed.name,
            arguments: typeof parsed.arguments === 'string'
              ? parsed.arguments
              : JSON.stringify(parsed.arguments || {}),
          },
        });
      }
    } catch { /* skip malformed */ }
  }
  return results;
}

function stripToolCallTags(text) {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

// ─── Auto-context: detect file paths in user input ──────────────────────────

const FILE_EXT_PATTERN = /(?:^|\s)((?:\.\/|\.\.\/|\/|[\w-]+\/)*[\w.-]+\.(?:js|ts|jsx|tsx|py|rs|go|java|json|yaml|yml|toml|md|css|html|sh|c|h|cpp|hpp|rb|php|swift|kt|vue|svelte))\b/g;

function detectAndReadFiles(userInput) {
  const paths = [];
  let match;
  const regex = new RegExp(FILE_EXT_PATTERN.source, FILE_EXT_PATTERN.flags);
  while ((match = regex.exec(userInput)) !== null) {
    paths.push(match[1]);
  }

  if (paths.length === 0) return null;

  const contexts = [];
  for (const p of [...new Set(paths)].slice(0, 3)) {
    try {
      const absPath = resolve(process.cwd(), p);
      const stat = statSync(absPath);
      if (stat.isFile() && stat.size < 50_000) {
        const content = readFileSync(absPath, 'utf-8');
        contexts.push(`\n--- Contents of ${p} ---\n${content}\n--- End of ${p} ---`);
      }
    } catch { /* file doesn't exist, skip */ }
  }

  return contexts.length > 0 ? contexts.join('\n') : null;
}

// ─── Core agent loop ────────────────────────────────────────────────────────

export async function runAgent(userInput, {
  conversation,
  provider,
  config,
  tools = null,
  autoApprove = false,
  maxRounds = MAX_ROUNDS_DEFAULT,
  callbacks = {},
}) {
  const {
    onSpinner,
    onSpinnerStop,
    onFirstToken,
    onToken,
    onResponseDone,
    onToolCall,
    onToolResult,
    onToolError,
    onError,
    onMaxRounds,
  } = callbacks;

  // Load tools (including plugins) if not provided
  if (!tools) tools = await getAllTools();

  // Smart tool selection — only send relevant tools to avoid overwhelming small models
  const selectedTools = selectToolsForInput(tools, userInput);

  // Check response cache
  const cacheKey = getCacheKey(userInput);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 300000) { // 5 min cache
    conversation.addUser(userInput);
    conversation.addAssistant(cached.text);
    if (onToken) onToken(cached.text);
    if (onResponseDone) onResponseDone({ fullText: cached.text, tokenCount: 0, totalTime: '0.0', tokensPerSec: 0, usage: null });
    return { fullText: cached.text, usage: null, rounds: 0, cached: true };
  }

  // Auto-context: detect file paths and inject contents
  const fileContext = detectAndReadFiles(userInput);
  const enrichedInput = fileContext
    ? `${userInput}\n\n[Auto-loaded file contents for context:]${fileContext}`
    : userInput;

  const sentimentPrompt = getSentimentPrompt(userInput);
  const finalInput = sentimentPrompt
    ? enrichedInput + sentimentPrompt
    : enrichedInput;

  conversation.addUser(finalInput);

  let round = 0;
  let lastUsage = null;

  while (round < maxRounds) {
    round++;

    // Adapt to system load
    if (round === 1 && shouldReduceLoad()) {
      maxRounds = Math.min(maxRounds, 8);
    }

    const startTime = Date.now();

    if (onSpinner) {
      onSpinner(round === 1
        ? `Sending to ${config.model}...`
        : `${config.model} is thinking... (round ${round})`
      );
    }

    try {
      const messages = conversation.getMessages();

      // After many rounds, stop sending tools to force a final text answer
      const useTools = round <= FORCE_ANSWER_AFTER ? selectedTools : [];
      if (round === FORCE_ANSWER_AFTER) {
        // Add a nudge to the conversation
        conversation.addUser('[System: You have used many tool rounds. Please provide your final answer now based on what you have learned.]');
      }

      const stream = provider.streamChat(messages, { tools: useTools });

      let firstToken = true;
      let tokenCount = 0;
      let operationUsage = null;
      let toolCalls = null;
      let fullText = '';

      for await (const token of stream) {
        if (typeof token === 'object' && token.tool_calls) {
          toolCalls = token.tool_calls;
          continue;
        }
        if (typeof token === 'object' && token.usage) {
          operationUsage = token.usage;
          continue;
        }
        // Text token
        if (firstToken) {
          const waitTime = ((Date.now() - startTime) / 1000).toFixed(1);
          if (onSpinnerStop) onSpinnerStop();
          if (onFirstToken) onFirstToken({ model: config.model, waitTime });
          firstToken = false;
        }
        tokenCount++;
        fullText += token;
        if (onToken) onToken(token);
      }

      if (firstToken && onSpinnerStop) onSpinnerStop(); // no tokens at all

      lastUsage = operationUsage;

      // ─── Fallback: parse text-based tool calls ─────────────────
      if ((!toolCalls || toolCalls.length === 0) && fullText) {
        const textToolCalls = parseTextToolCalls(fullText);
        if (textToolCalls.length > 0) {
          toolCalls = textToolCalls;
          fullText = stripToolCallTags(fullText);
        }
      }

      // ─── Handle tool calls ────────────────────────────────────
      if (toolCalls && toolCalls.length > 0) {
        conversation.addAssistantToolCalls(fullText, toolCalls);

        for (const tc of toolCalls) {
          let parsedArgs;
          try {
            parsedArgs = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
          } catch {
            parsedArgs = tc.function.arguments;
          }

          if (onToolCall) onToolCall(tc.function.name, parsedArgs);

          try {
            const result = await executeTool(tc.function.name, parsedArgs, { autoApprove });
            if (onToolResult) onToolResult(tc.function.name, result);
            conversation.addToolResult(tc.id, tc.function.name, result);
          } catch (err) {
            const errMsg = `Error executing ${tc.function.name}: ${err.message}`;
            if (onToolError) onToolError(tc.function.name, err);
            conversation.addToolResult(tc.id, tc.function.name, errMsg);
          }
        }

        continue; // loop — model will see tool results
      }

      // ─── No tool calls — final text response ──────────────────
      if (fullText) {
        conversation.addAssistant(fullText);
      }

      // Cache text-only responses (no tool calls were used)
      if (round === 1 && fullText) {
        responseCache.set(cacheKey, { text: fullText, time: Date.now() });
        if (responseCache.size > MAX_CACHE_SIZE) {
          const oldest = responseCache.keys().next().value;
          responseCache.delete(oldest);
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const tokensPerSec = tokenCount > 0
        ? tokenCount / ((Date.now() - startTime) / 1000)
        : 0;

      if (onResponseDone) {
        onResponseDone({
          fullText,
          tokenCount,
          totalTime,
          tokensPerSec,
          usage: operationUsage,
        });
      }

      return { fullText, usage: operationUsage, rounds: round };

    } catch (err) {
      if (onSpinnerStop) onSpinnerStop();
      if (onError) onError(err);
      // Remove the failed user message on first round
      if (round === 1) {
        conversation.messages.pop();
      }
      return { fullText: '', error: err.message, rounds: round };
    }
  }

  // Hit max rounds
  if (onMaxRounds) onMaxRounds();
  return { fullText: '', rounds: round, maxRoundsReached: true };
}
