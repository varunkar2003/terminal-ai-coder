import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { readFile } from './fileReader.js';
import { writeFile, editFile } from './fileWriter.js';
import { runCommand } from './executor.js';
import { globSearch } from './globSearch.js';
import { grepSearch } from './grepSearch.js';
import { webSearch } from './webSearch.js';
import { webFetch } from './webFetch.js';
import {
  browserNavigate, browserClick, browserType, browserScreenshot,
  browserGetText, browserGetLinks, browserGetInputs, browserSubmit,
} from './browser.js';
import { memorySet, memoryGet, memoryList } from './memory.js';
import { runAppleScript, openApp, showNotification } from './applescript.js';
import { gitStatus, gitDiff, gitLog, gitCommit, gitPush } from './git.js';
import { scheduleTask, listTasks, cancelTask } from './scheduler.js';
import { spawnAgent } from './multiagent.js';
import { isPlugin, executePlugin } from './plugins.js';
import { recordChange, undoLast, undoHistory } from './undo.js';
import { captureScreen } from './screenshot.js';
import { deployVercel, deployNetlify, deploySSH } from './deploy.js';
import { dbQuery, dbDescribe } from './database.js';
import { testEndpoint, healthCheck } from './apitest.js';
import { learnPatterns } from './codelearn.js';
import { watchProject, getRecentChanges } from './filewatcher.js';
import { fileHistory, fileAtCommit, findBugIntroduction, blame, whatChanged } from './timetravel.js';
import { createTool } from './selfevolve.js';
import { saveKnowledge, getKnowledge, learnFromProject } from './knowledge.js';
import { analyzeWebsite } from './reverseeng.js';
import { getBalance, getTransaction, getGasPrice } from './blockchain.js';
import { switchModel, autoSelectModel } from './modelswap.js';
import { startProcess, stopProcess, processLogs, listProcesses } from './procmanager.js';
import { securityScan } from './pentest.js';
import { getSystemInfo, getResourceUsage } from './hardware.js';
import { confirm } from '../ui/prompt.js';
import chalk from 'chalk';

export async function executeTool(name, args, options = {}) {
  const { autoApprove = false } = options;

  switch (name) {
    case 'read_file': {
      const result = readFile(args.file_path, { lines: args.lines });
      return result.content;
    }

    case 'write_file': {
      // Record for undo
      let oldContent = '';
      try { oldContent = readFileSync(resolve(process.cwd(), args.file_path), 'utf-8'); } catch {}

      if (!autoApprove) {
        if (oldContent) {
          // Show brief diff preview
          const oldLines = oldContent.split('\n').length;
          const newLines = args.content.split('\n').length;
          console.log(chalk.gray(`  ${args.file_path}: ${oldLines} lines -> ${newLines} lines`));
        }
        const ok = await confirm(`Write to ${chalk.cyan(args.file_path)}?`);
        if (!ok) return 'User denied the write operation.';
      }

      const result = writeFile(args.file_path, args.content);
      recordChange(args.file_path, oldContent);
      return `File written: ${result.path} (${result.size} bytes)`;
    }

    case 'edit_file': {
      // Record for undo
      let oldContent = '';
      try { oldContent = readFileSync(resolve(process.cwd(), args.file_path), 'utf-8'); } catch {}

      if (!autoApprove) {
        // Show search -> replace preview
        const searchPreview = (args.search || '').substring(0, 60).replace(/\n/g, '\\n');
        const replacePreview = (args.replace || '').substring(0, 60).replace(/\n/g, '\\n');
        console.log(chalk.gray(`  ${args.file_path}: "${searchPreview}" -> "${replacePreview}"`));
        const ok = await confirm(`Edit ${chalk.cyan(args.file_path)}?`);
        if (!ok) return 'User denied the edit operation.';
      }

      const result = editFile(args.file_path, args.search, args.replace);
      recordChange(args.file_path, oldContent);
      return `File edited: ${result.path}`;
    }

    case 'run_command': {
      if (!autoApprove) {
        const ok = await confirm(`Run: ${chalk.yellow(args.command)}?`);
        if (!ok) return 'User denied the command execution.';
      }
      const result = runCommand(args.command);
      if (result.success) {
        return result.output || '(no output)';
      }
      return `Command failed (exit ${result.exitCode}):\n${result.output}`;
    }

    case 'glob_search': {
      const result = await globSearch(args.pattern);
      if (result.results.length === 0) return `No files matching: ${args.pattern}`;
      let output = result.results.join('\n');
      if (result.truncated) output += `\n... (${result.total} total, showing ${result.results.length})`;
      return output;
    }

    case 'grep_search': {
      const result = await grepSearch(args.pattern, args.file_glob || '**/*');
      if (result.results.length === 0) return `No matches for: ${args.pattern}`;
      let output = result.results
        .map(r => `${r.file}:${r.line}: ${r.content}`)
        .join('\n');
      if (result.truncated) output += `\n... (more results exist)`;
      return output;
    }

    case 'web_search': {
      const result = await webSearch(args.query);
      return result.formatted;
    }

    case 'web_fetch': {
      const result = await webFetch(args.url);
      return result.content;
    }

    case 'browser_navigate':
      return await browserNavigate(args.url);

    case 'browser_click':
      return await browserClick(args.selector);

    case 'browser_type':
      return await browserType(args.selector, args.text);

    case 'browser_screenshot':
      return await browserScreenshot();

    case 'browser_get_text':
      return await browserGetText();

    case 'browser_get_links':
      return await browserGetLinks();

    case 'browser_get_inputs':
      return await browserGetInputs();

    case 'browser_submit':
      return await browserSubmit(args.selector || '');

    // ─── Memory ───────────────────────────────────────────────
    case 'memory_set':
      return memorySet(args.key, args.value);
    case 'memory_get':
      return memoryGet(args.key);
    case 'memory_list':
      return memoryList();

    // ─── Mac Control ──────────────────────────────────────────
    case 'mac_run_applescript':
      return runAppleScript(args.script);
    case 'mac_open_app':
      return openApp(args.app_name);
    case 'mac_notification':
      return showNotification(args.title, args.message);

    // ─── Git ──────────────────────────────────────────────────
    case 'git_status':
      return gitStatus();
    case 'git_diff':
      return gitDiff(args.staged || false);
    case 'git_log':
      return gitLog(args.count || 10);
    case 'git_commit': {
      if (!options.autoApprove) {
        const ok = await confirm(`Commit: ${chalk.cyan(args.message)}?`);
        if (!ok) return 'User denied the commit.';
      }
      return gitCommit(args.message);
    }
    case 'git_push': {
      if (!options.autoApprove) {
        const ok = await confirm('Push to remote?');
        if (!ok) return 'User denied the push.';
      }
      return gitPush();
    }

    // ─── Scheduler ────────────────────────────────────────────
    case 'schedule_task':
      return scheduleTask(args.name, args.command, args.interval_minutes);
    case 'list_scheduled_tasks':
      return listTasks();
    case 'cancel_scheduled_task':
      return cancelTask(args.name);

    // ─── Multi-Agent ──────────────────────────────────────────
    case 'spawn_agent':
      return await spawnAgent(args.task);

    // ─── Undo ────────────────────────────────────────────────
    case 'undo_last':
      return undoLast();
    case 'undo_history':
      return undoHistory();

    // ─── Project Templates ───────────────────────────────────
    case 'create_project': {
      const { createProject } = await import('./templates.js');
      return createProject(args.template, args.name);
    }

    // ─── Screen Capture ───────────────────────────────────────
    case 'capture_screen': {
      const result = captureScreen();
      return `Screenshot saved: ${result.filepath}`;
    }

    // ─── Deploy ───────────────────────────────────────────────
    case 'deploy': {
      if (!options.autoApprove) {
        const ok = await confirm(`Deploy to ${chalk.cyan(args.platform)}?`);
        if (!ok) return 'User denied deployment.';
      }
      switch (args.platform) {
        case 'vercel': return deployVercel();
        case 'netlify': return deployNetlify();
        case 'ssh': return deploySSH(args.host, args.path);
        default: return `Unknown platform: ${args.platform}. Use: vercel, netlify, or ssh`;
      }
    }

    // ─── Database ─────────────────────────────────────────────
    case 'db_query':
      return dbQuery(args.db_path, args.query);
    case 'db_describe':
      return dbDescribe(args.db_path);

    // ─── API Testing ──────────────────────────────────────────
    case 'test_api': {
      let body = null;
      if (args.body) { try { body = JSON.parse(args.body); } catch { body = args.body; } }
      return await testEndpoint(args.url, args.method || 'GET', body);
    }
    case 'health_check':
      return await healthCheck(args.base_url);

    // ─── Code Learning ────────────────────────────────────────
    case 'learn_code_patterns':
      return learnPatterns();

    // ─── File Watching ────────────────────────────────────────
    case 'watch_files':
      return watchProject();
    case 'get_file_changes':
      return getRecentChanges();

    // ─── Time Travel ───────────────────────────────────────────
    case 'file_history': return fileHistory(args.file_path, args.count);
    case 'file_at_commit': return fileAtCommit(args.file_path, args.commit);
    case 'find_bug_commit': return findBugIntroduction(args.file_path, args.search_text);
    case 'what_changed': return whatChanged(args.days || 7);
    case 'git_blame': return blame(args.file_path, args.line_start, args.line_end);

    // ─── Self-Evolving ─────────────────────────────────────────
    case 'create_tool': return createTool(args.name, args.description, args.parameters || '{ type: "object", properties: {} }', args.code);

    // ─── Knowledge ─────────────────────────────────────────────
    case 'save_knowledge': return saveKnowledge(args.topic, args.content);
    case 'get_knowledge': return getKnowledge(args.topic);
    case 'learn_from_project': return learnFromProject();

    // ─── Reverse Engineering ───────────────────────────────────
    case 'analyze_website': return await analyzeWebsite(args.url);

    // ─── Blockchain ────────────────────────────────────────────
    case 'blockchain_balance': return await getBalance(args.address, args.chain);
    case 'blockchain_tx': return await getTransaction(args.tx_hash, args.chain);
    case 'blockchain_gas': return await getGasPrice(args.chain);

    // ─── Model Swap ────────────────────────────────────────────
    case 'switch_model': return await switchModel(args.model);
    case 'auto_select_model': return await autoSelectModel(args.task);

    // ─── Process Manager ───────────────────────────────────────
    case 'start_process': return startProcess(args.name, args.command);
    case 'stop_process': return stopProcess(args.name);
    case 'process_logs': return processLogs(args.name, args.count);
    case 'list_processes': return listProcesses();

    // ─── Security ──────────────────────────────────────────────
    case 'security_scan': return await securityScan(args.url);

    // ─── Hardware ──────────────────────────────────────────────
    case 'system_info': return getSystemInfo();
    case 'resource_usage': return getResourceUsage();

    default:
      // Check plugins
      if (isPlugin(name)) {
        return await executePlugin(name, args);
      }
      return `Unknown tool: ${name}`;
  }
}
