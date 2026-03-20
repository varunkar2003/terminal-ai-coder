// Deploy pipeline — Vercel, Netlify, or custom server

import { execSync } from 'child_process';

function run(cmd) {
  return execSync(cmd, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function cmdExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

export function deployVercel() {
  if (!cmdExists('vercel')) {
    return 'Vercel CLI not installed. Run: npm i -g vercel';
  }
  try {
    const result = run('vercel --yes 2>&1');
    return `Deployed to Vercel:\n${result}`;
  } catch (err) {
    return `Deploy failed: ${err.stdout || err.stderr || err.message}`;
  }
}

export function deployNetlify() {
  if (!cmdExists('netlify')) {
    return 'Netlify CLI not installed. Run: npm i -g netlify-cli';
  }
  try {
    const result = run('netlify deploy --prod 2>&1');
    return `Deployed to Netlify:\n${result}`;
  } catch (err) {
    return `Deploy failed: ${err.stdout || err.stderr || err.message}`;
  }
}

export function deploySSH(host, path, user = 'root') {
  try {
    // Build if package.json has build script
    try { run('npm run build 2>&1'); } catch {}

    // Determine what to deploy
    const deployDir = ['dist', 'build', '.'].find(d => {
      try { return require('fs').existsSync(d); } catch { return false; }
    }) || '.';

    const result = run(`rsync -avz --exclude node_modules --exclude .git ${deployDir}/ ${user}@${host}:${path} 2>&1`);
    return `Deployed to ${host}:${path}\n${result}`;
  } catch (err) {
    return `Deploy failed: ${err.message}`;
  }
}

export function checkDeployTools() {
  const tools = ['vercel', 'netlify', 'rsync', 'ssh', 'git'];
  return tools.map(t => `${t}: ${cmdExists(t) ? 'installed' : 'not found'}`).join('\n');
}
