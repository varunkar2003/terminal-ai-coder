// Screen capture on macOS + serve via web UI

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

const SCREENSHOT_DIR = join(homedir(), '.vkcoder', 'screenshots');

export function captureScreen(region) {
  if (platform() !== 'darwin') throw new Error('Screen capture only works on macOS');
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const filename = `screen_${Date.now()}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);

  // -x = no sound, -C = capture cursor
  const cmd = region
    ? `screencapture -x -R${region} "${filepath}"`
    : `screencapture -x -C "${filepath}"`;

  execSync(cmd, { timeout: 10000 });
  return { filepath, filename };
}

export function captureWindow() {
  if (platform() !== 'darwin') throw new Error('Screen capture only works on macOS');
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const filename = `window_${Date.now()}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  execSync(`screencapture -x -l$(osascript -e 'tell app "System Events" to get id of first window of first application process whose frontmost is true') "${filepath}"`, {
    timeout: 10000,
  });
  return { filepath, filename };
}

export function getScreenshotBase64(filepath) {
  const data = readFileSync(filepath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

export function listScreenshots() {
  if (!existsSync(SCREENSHOT_DIR)) return 'No screenshots yet.';
  const { readdirSync } = require('fs');
  const files = readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort().reverse().slice(0, 10);
  if (files.length === 0) return 'No screenshots yet.';
  return files.map(f => join(SCREENSHOT_DIR, f)).join('\n');
}
