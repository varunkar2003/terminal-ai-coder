import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfig } from '../config.js';

const CHARS_PER_TOKEN = 4; // rough heuristic
const VKCODER_DIR = join(homedir(), '.vkcoder');
const HISTORY_FILE = join(VKCODER_DIR, 'conversation.json');

export class Conversation {
  constructor() {
    this.messages = [];
    this.systemPrompt = null;
  }

  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }

  addUser(content) {
    this.messages.push({ role: 'user', content });
    this._truncateIfNeeded();
  }

  addAssistant(content) {
    this.messages.push({ role: 'assistant', content });
    this._truncateIfNeeded();
    this.save();
  }

  addAssistantToolCalls(content, toolCalls) {
    this.messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
    });
  }

  addToolResult(toolCallId, name, result) {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    });
  }

  getMessages() {
    const result = [];
    if (this.systemPrompt) {
      result.push({ role: 'system', content: this.systemPrompt });
    }
    return result.concat(this.messages);
  }

  clear() {
    this.messages = [];
    this.save();
  }

  getTokenEstimate() {
    let chars = 0;
    if (this.systemPrompt) chars += this.systemPrompt.length;
    for (const msg of this.messages) {
      if (msg.content) chars += msg.content.length;
      if (msg.tool_calls) chars += JSON.stringify(msg.tool_calls).length;
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

  _truncateIfNeeded() {
    const { contextWindow } = getConfig();
    const maxTokens = contextWindow * 0.75;

    if (this.getTokenEstimate() <= maxTokens || this.messages.length <= 4) return;

    // Collect old messages to summarize (keep last 4)
    const toSummarize = this.messages.slice(0, -4);
    const kept = this.messages.slice(-4);

    if (toSummarize.length === 0) return;

    // Create summary from old messages
    const summaryParts = toSummarize
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role}: ${(m.content || '').substring(0, 150)}`)
      .join('\n');

    const summary = summaryParts.substring(0, 800);

    this.messages = [
      { role: 'system', content: `[Earlier conversation summary]\n${summary}` },
      ...kept,
    ];
  }

  save() {
    try {
      if (!existsSync(VKCODER_DIR)) {
        mkdirSync(VKCODER_DIR, { recursive: true });
      }
      // Only save text messages (skip tool_calls/tool results for cross-provider compat)
      const saveable = this.messages.filter(m =>
        (m.role === 'user' || m.role === 'assistant') && !m.tool_calls
      );
      writeFileSync(HISTORY_FILE, JSON.stringify({ messages: saveable }, null, 2), 'utf-8');
    } catch {
      // silently ignore save errors
    }
  }

  load() {
    try {
      if (existsSync(HISTORY_FILE)) {
        const data = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
        if (data.messages && Array.isArray(data.messages)) {
          this.messages = data.messages;
        }
      }
    } catch {
      // silently ignore load errors
    }
  }

  get length() {
    return this.messages.length;
  }
}
