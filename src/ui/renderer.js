import chalk from 'chalk';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { highlight } from 'cli-highlight';

const marked = new Marked(markedTerminal());

export function renderMarkdown(text) {
  return marked.parse(text);
}

export function highlightCode(code, language) {
  try {
    return highlight(code, { language: language || 'auto', ignoreIllegals: true });
  } catch {
    return code;
  }
}

export class StreamRenderer {
  constructor() {
    this.buffer = '';
    this.finished = false;
  }

  write(token) {
    this.buffer += token;
    process.stdout.write(token);
  }

  end() {
    this.finished = true;
    if (this.buffer) {
      // Print a newline after streaming
      process.stdout.write('\n');
    }
  }

  getFullText() {
    return this.buffer;
  }

  renderFinal() {
    // Clear the raw streamed output and re-render with markdown formatting
    // Move cursor up and clear lines for the raw text, then print formatted
    // For simplicity, just print a separator and the formatted version
    if (!this.buffer.trim()) return '';

    const formatted = renderMarkdown(this.buffer);
    return formatted;
  }
}

export function renderError(message) {
  console.log(`${chalk.red('✗')} ${chalk.red(message)}`);
}

export function renderSuccess(message) {
  console.log(`${chalk.green('✓')} ${chalk.green(message)}`);
}

export function renderWarning(message) {
  console.log(`${chalk.yellow('⚠')} ${chalk.yellow(message)}`);
}

export function renderToolOutput(title, content) {
  console.log(`\n${chalk.cyan('┌')} ${chalk.cyan.bold(title)}`);
  const lines = content.split('\n');
  for (const line of lines) {
    console.log(`${chalk.cyan('│')} ${line}`);
  }
  console.log(`${chalk.cyan('└')}\n`);
}

export function renderDivider() {
  console.log(chalk.gray('─'.repeat(60)));
}
