import { getConfig } from '../config.js';

const CHARS_PER_TOKEN = 4; // rough heuristic

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
  }

  getTokenEstimate() {
    let chars = 0;
    if (this.systemPrompt) chars += this.systemPrompt.length;
    for (const msg of this.messages) {
      chars += msg.content.length;
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

  _truncateIfNeeded() {
    const { contextWindow } = getConfig();
    const maxTokens = contextWindow * 0.75; // Leave room for response

    while (this.messages.length > 2 && this.getTokenEstimate() > maxTokens) {
      // Remove oldest user-assistant pair, keeping at least the last exchange
      this.messages.shift();
      if (this.messages.length > 0 && this.messages[0].role === 'assistant') {
        this.messages.shift();
      }
    }
  }

  get length() {
    return this.messages.length;
  }
}
