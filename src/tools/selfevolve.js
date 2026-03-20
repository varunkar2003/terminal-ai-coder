// Self-Evolving Tools — AI writes its own tools as plugins

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PLUGINS_DIR = join(homedir(), '.vkcoder', 'plugins');

export function createTool(name, description, parameters, code) {
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });

  // Validate name
  const safeName = name.replace(/[^a-z0-9_]/g, '_').toLowerCase();

  // Build the plugin file
  const paramSchema = typeof parameters === 'string'
    ? parameters
    : JSON.stringify(parameters, null, 2);

  const pluginCode = `// Auto-generated tool: ${safeName}
// ${description}

export const name = '${safeName}';
export const description = '${description.replace(/'/g, "\\'")}';
export const parameters = ${paramSchema};

export async function execute(args) {
${code.split('\n').map(l => '  ' + l).join('\n')}
}
`;

  const filepath = join(PLUGINS_DIR, `${safeName}.js`);
  writeFileSync(filepath, pluginCode, 'utf-8');

  return `Tool "${safeName}" created at ${filepath}\nIt will be available after restarting VKCoder, or you can use run_command to test it.`;
}

export function listCustomTools() {
  if (!existsSync(PLUGINS_DIR)) return 'No custom tools yet. Use create_tool to make one.';

  const { readdirSync, readFileSync } = require('fs');
  const files = readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));

  if (files.length === 0) return 'No custom tools yet.';

  return files.map(f => {
    try {
      const content = readFileSync(join(PLUGINS_DIR, f), 'utf-8');
      const nameMatch = content.match(/export const name = '([^']+)'/);
      const descMatch = content.match(/export const description = '([^']+)'/);
      return `- ${nameMatch?.[1] || f}: ${descMatch?.[1] || '(no description)'}`;
    } catch {
      return `- ${f}: (error reading)`;
    }
  }).join('\n');
}
