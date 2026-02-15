import ora from 'ora';

let currentSpinner = null;

export function startSpinner(text = 'Thinking...') {
  stopSpinner();
  currentSpinner = ora({ text, spinner: 'dots' }).start();
  return currentSpinner;
}

export function updateSpinner(text) {
  if (currentSpinner) {
    currentSpinner.text = text;
  }
}

export function stopSpinner() {
  if (currentSpinner) {
    currentSpinner.stop();
    currentSpinner = null;
  }
}

export function succeedSpinner(text) {
  if (currentSpinner) {
    currentSpinner.succeed(text);
    currentSpinner = null;
  }
}

export function failSpinner(text) {
  if (currentSpinner) {
    currentSpinner.fail(text);
    currentSpinner = null;
  }
}
