import { createInterface } from 'readline';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const VKCODER_DIR = join(homedir(), '.vkcoder');
const HISTORY_FILE = join(VKCODER_DIR, 'readline_history');

let rl = null;

function getReadline() {
  if (!rl) {
    // Load existing history
    let history = [];
    if (existsSync(HISTORY_FILE)) {
      try {
        history = readFileSync(HISTORY_FILE, 'utf-8')
          .split('\n')
          .filter(Boolean)
          .reverse()
          .slice(0, 500);
      } catch { /* ignore */ }
    }

    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      history,
      historySize: 500,
    });

    // Persist each line to history file
    rl.on('line', (line) => {
      if (line.trim()) {
        try {
          if (!existsSync(VKCODER_DIR)) {
            mkdirSync(VKCODER_DIR, { recursive: true });
          }
          appendFileSync(HISTORY_FILE, line + '\n');
        } catch { /* ignore */ }
      }
    });
  }
  return rl;
}

export function prompt(promptText = `${chalk.cyan('vkcoder')}${chalk.gray('>')} `) {
  return new Promise((resolve) => {
    getReadline().question(promptText, (answer) => {
      resolve(answer);
    });
  });
}

export async function multiLinePrompt() {
  const lines = [];
  const readline = getReadline();

  process.stdout.write(chalk.gray('  (multi-line mode — enter ``` to finish)\n'));

  return new Promise((resolve) => {
    const onLine = (line) => {
      if (line.trim() === '```') {
        readline.removeListener('line', onLine);
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
        process.stdout.write(chalk.gray('... '));
      }
    };
    process.stdout.write(chalk.gray('... '));
    readline.on('line', onLine);
  });
}

export async function confirm(message) {
  const answer = await prompt(`${chalk.yellow('?')} ${message} ${chalk.gray('(y/n)')} `);
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
}

export function closePrompt() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
