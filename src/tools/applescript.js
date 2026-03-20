// macOS automation via AppleScript/JXA

import { execSync } from 'child_process';
import { platform } from 'os';

export function runAppleScript(script) {
  if (platform() !== 'darwin') {
    throw new Error('AppleScript is only available on macOS');
  }

  try {
    const result = execSync(`osascript -e ${escapeForShell(script)}`, {
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || '(command executed successfully)';
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    throw new Error(`AppleScript error: ${output || err.message}`);
  }
}

function escapeForShell(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

// Pre-built helpers for common tasks
export function openApp(appName) {
  return runAppleScript(`tell application "${appName}" to activate`);
}

export function getActiveApp() {
  return runAppleScript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  );
}

export function showNotification(title, message) {
  return runAppleScript(
    `display notification "${message}" with title "${title}"`
  );
}

export function typeText(text) {
  return runAppleScript(
    `tell application "System Events" to keystroke "${text}"`
  );
}

export function pressKey(key, modifiers = '') {
  if (modifiers) {
    return runAppleScript(
      `tell application "System Events" to key code ${key} using {${modifiers}}`
    );
  }
  return runAppleScript(
    `tell application "System Events" to key code ${key}`
  );
}

export function getClipboard() {
  return runAppleScript('the clipboard');
}

export function setClipboard(text) {
  return runAppleScript(`set the clipboard to "${text}"`);
}
