// Database assistant — SQLite via CLI, or any DB via shell commands

import { execSync } from 'child_process';
import { existsSync } from 'fs';

function runSqlite(dbPath, query) {
  if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

  const result = execSync(
    `sqlite3 -header -column "${dbPath}" "${query.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 15000, maxBuffer: 1024 * 1024 }
  );
  return result.trim() || '(no results)';
}

export function dbQuery(dbPath, query) {
  try {
    return runSqlite(dbPath, query);
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    throw new Error(output.trim() || err.message);
  }
}

export function dbTables(dbPath) {
  return dbQuery(dbPath, '.tables');
}

export function dbSchema(dbPath, table) {
  if (table) {
    return dbQuery(dbPath, `.schema ${table}`);
  }
  return dbQuery(dbPath, '.schema');
}

export function dbDescribe(dbPath) {
  const tables = dbQuery(dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  if (!tables || tables === '(no results)') return 'No tables found.';

  const tableNames = tables.split('\n').filter(l => l.trim() && !l.startsWith('-') && !l.startsWith('name'));
  const descriptions = [];

  for (const name of tableNames.slice(0, 20)) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    try {
      const info = dbQuery(dbPath, `PRAGMA table_info(${trimmed});`);
      descriptions.push(`Table: ${trimmed}\n${info}`);
    } catch {}
  }

  return descriptions.join('\n\n') || 'No table info available.';
}

// For other databases, use CLI tools
export function dbPostgres(query, connectionString) {
  try {
    const result = execSync(
      `psql "${connectionString}" -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', timeout: 15000 }
    );
    return result.trim();
  } catch (err) {
    throw new Error((err.stderr || err.message).trim());
  }
}
