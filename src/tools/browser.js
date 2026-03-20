import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SCREENSHOT_DIR = join(homedir(), '.vkcoder', 'screenshots');
let browser = null;
let page = null;

// ─── Find Chromium ──────────────────────────────────────────────────────────

function findChromePath() {
  // Check playwright's installed chromium first
  try {
    const result = execSync('npx playwright-core install --dry-run chromium 2>&1 || true', {
      encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Check common playwright cache paths
    const paths = [
      join(homedir(), 'Library/Caches/ms-playwright'),
      join(homedir(), '.cache/ms-playwright'),
    ];
    for (const base of paths) {
      if (existsSync(base)) {
        // Find any chromium-headless-shell directory
        try {
          const dirs = execSync(`ls -d ${base}/chromium*/chrome-*/headless_shell 2>/dev/null || ls -d ${base}/chromium-headless-shell-*/chrome-*/headless_shell 2>/dev/null || true`, {
            encoding: 'utf-8', timeout: 3000,
          }).trim().split('\n').filter(Boolean);
          if (dirs.length > 0) return dirs[dirs.length - 1];
        } catch {}
      }
    }
  } catch {}

  // Check system browsers
  const systemPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];

  for (const p of systemPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

// ─── Browser lifecycle ──────────────────────────────────────────────────────

async function ensureBrowser() {
  if (browser && page) return page;

  const execPath = findChromePath();

  browser = await chromium.launch({
    headless: true,
    ...(execPath ? { executablePath: execPath } : {}),
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  page = await context.newPage();
  return page;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    page = null;
  }
}

// Close browser on process exit
process.on('exit', () => { if (browser) browser.close().catch(() => {}); });
process.on('SIGINT', () => { closeBrowser(); });

// ─── Browser actions ────────────────────────────────────────────────────────

export async function browserNavigate(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  const p = await ensureBrowser();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const title = await p.title();
  const pageUrl = p.url();
  return `Navigated to: ${title}\nURL: ${pageUrl}`;
}

export async function browserClick(selector) {
  const p = await ensureBrowser();
  await p.click(selector, { timeout: 10000 });
  await p.waitForTimeout(1000);
  const title = await p.title();
  return `Clicked: ${selector}\nPage: ${title} (${p.url()})`;
}

export async function browserType(selector, text) {
  const p = await ensureBrowser();
  await p.fill(selector, text, { timeout: 10000 });
  return `Typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" into ${selector}`;
}

export async function browserScreenshot() {
  const p = await ensureBrowser();
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filename = `screenshot_${Date.now()}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  await p.screenshot({ path: filepath, fullPage: false });
  return `Screenshot saved: ${filepath}`;
}

export async function browserGetText() {
  const p = await ensureBrowser();
  const text = await p.evaluate(() => {
    // Get visible text, skip scripts/styles
    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if (parent.offsetParent === null && tag !== 'BODY') return NodeFilter.FILTER_REJECT;
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const texts = [];
    while (walker.nextNode()) {
      texts.push(walker.currentNode.textContent.trim());
    }
    return texts.join('\n');
  });

  const truncated = text.length > 10000 ? text.substring(0, 10000) + '\n...(truncated)' : text;
  return `Page: ${await p.title()}\nURL: ${p.url()}\n\n${truncated}`;
}

export async function browserGetLinks() {
  const p = await ensureBrowser();
  const links = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).slice(0, 30).map(a => ({
      text: a.textContent.trim().substring(0, 60),
      href: a.href,
    }));
  });
  return links.map((l, i) => `${i + 1}. [${l.text || '(no text)'}] ${l.href}`).join('\n');
}

export async function browserGetInputs() {
  const p = await ensureBrowser();
  const inputs = await p.evaluate(() => {
    const els = document.querySelectorAll('input, textarea, select, button[type="submit"], button:not([type])');
    return Array.from(els).slice(0, 30).map(el => {
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type') || '';
      const name = el.getAttribute('name') || '';
      const id = el.id || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const value = el.value || '';
      const text = el.textContent?.trim().substring(0, 40) || '';
      let selector = '';
      if (id) selector = `#${id}`;
      else if (name) selector = `${tag}[name="${name}"]`;
      else selector = `${tag}[type="${type}"]`;
      return { tag, type, name, id, placeholder, value, text, selector };
    });
  });

  return inputs.map((inp, i) => {
    const desc = inp.placeholder || inp.text || inp.name || inp.type || inp.tag;
    return `${i + 1}. <${inp.tag}> "${desc}" → selector: ${inp.selector}`;
  }).join('\n');
}

export async function browserSubmit(selector) {
  const p = await ensureBrowser();
  if (selector) {
    await p.click(selector, { timeout: 10000 });
  } else {
    await p.keyboard.press('Enter');
  }
  await p.waitForTimeout(2000);
  return `Submitted. Page: ${await p.title()} (${p.url()})`;
}

export async function browserWait(ms) {
  const p = await ensureBrowser();
  await p.waitForTimeout(Math.min(ms || 2000, 10000));
  return `Waited ${ms || 2000}ms. Page: ${await p.title()}`;
}

export async function browserClose() {
  await closeBrowser();
  return 'Browser closed.';
}
