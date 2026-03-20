// Plugin system — load custom tools from ~/.vkcoder/plugins/

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { pathToFileURL } from 'url';

const PLUGINS_DIR = join(homedir(), '.vkcoder', 'plugins');
const loadedPlugins = new Map();

export async function loadPlugins() {
  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
    return { tools: [], count: 0 };
  }

  const files = readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  const tools = [];

  for (const file of files) {
    try {
      const filePath = join(PLUGINS_DIR, file);
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);

      if (!mod.name || !mod.execute) {
        console.error(`Plugin ${file}: must export name and execute`);
        continue;
      }

      const tool = {
        type: 'function',
        function: {
          name: `plugin_${mod.name}`,
          description: mod.description || `Custom plugin: ${mod.name}`,
          parameters: mod.parameters || { type: 'object', properties: {} },
        },
      };

      tools.push(tool);
      loadedPlugins.set(`plugin_${mod.name}`, mod.execute);
    } catch (err) {
      console.error(`Failed to load plugin ${file}: ${err.message}`);
    }
  }

  return { tools, count: tools.length };
}

export async function executePlugin(name, args) {
  const fn = loadedPlugins.get(name);
  if (!fn) throw new Error(`Plugin not found: ${name}`);
  return await fn(args);
}

export function isPlugin(name) {
  return loadedPlugins.has(name);
}

// Example plugin file (~/.vkcoder/plugins/hello.js):
//
// export const name = 'hello';
// export const description = 'Say hello to someone';
// export const parameters = {
//   type: 'object',
//   properties: {
//     who: { type: 'string', description: 'Who to greet' }
//   },
//   required: ['who']
// };
// export async function execute(args) {
//   return `Hello, ${args.who}!`;
// }
