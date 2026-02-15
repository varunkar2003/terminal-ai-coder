import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';

function validatePath(filePath) {
  const resolved = resolve(process.cwd(), filePath);
  const rel = relative(process.cwd(), resolved);
  if (rel.startsWith('..')) {
    throw new Error(`Path traversal denied: ${filePath} is outside the project directory`);
  }
  return resolved;
}

export function writeFile(filePath, content) {
  const absPath = validatePath(filePath);
  const dir = dirname(absPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(absPath, content, 'utf-8');
  return { path: filePath, action: 'created', size: content.length };
}

export function editFile(filePath, search, replace) {
  const absPath = validatePath(filePath);

  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(absPath, 'utf-8');

  if (!content.includes(search)) {
    throw new Error(`Search text not found in ${filePath}`);
  }

  const newContent = content.replace(search, replace);
  writeFileSync(absPath, newContent, 'utf-8');

  const changes = content !== newContent ? 1 : 0;
  return { path: filePath, action: 'edited', changes };
}

export function parseWriteArgs(argsStr) {
  // Format: /write <file> <content>
  // Or: /write <file> --edit <search> --- <replace>
  const trimmed = argsStr.trim();

  if (trimmed.includes('--edit')) {
    const [fileAndFlag, rest] = trimmed.split('--edit');
    const filePath = fileAndFlag.trim();
    const [search, replace] = rest.split('---').map(s => s.trim());
    return { filePath, mode: 'edit', search, replace };
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { filePath: trimmed, mode: 'write', content: '' };
  }

  return {
    filePath: trimmed.substring(0, firstSpace),
    mode: 'write',
    content: trimmed.substring(firstSpace + 1),
  };
}
