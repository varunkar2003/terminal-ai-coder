import { createInterface } from 'readline';
import chalk from 'chalk';

let rl = null;

function getReadline() {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
  }
  return rl;
}

export function prompt(promptText = `${chalk.cyan('starcode')}${chalk.gray('>')} `) {
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
