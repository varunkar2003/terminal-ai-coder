// Multi-agent — spawn sub-agents for parallel task execution

import { Conversation } from '../context/conversation.js';
import { getProjectContext } from '../context/project.js';
import { getConfig } from '../config.js';
import { getProvider } from '../providers/router.js';
import { TOOL_DEFINITIONS } from './definitions.js';
import { runAgent } from '../agent.js';

export async function spawnAgent(taskDescription) {
  // Create a fresh conversation for the sub-agent
  const conv = new Conversation();
  const config = getConfig();
  const ctx = getProjectContext();
  conv.setSystemPrompt(
    `${config.systemPrompt}\n\n${ctx}\n\nYou are a sub-agent working on a specific task. Complete it and report your results concisely.`
  );

  const provider = await getProvider();

  const result = await runAgent(taskDescription, {
    conversation: conv,
    provider,
    config,
    tools: TOOL_DEFINITIONS,
    autoApprove: true,
    maxRounds: 10,
    callbacks: {},
  });

  return result.fullText || result.error || '(no output from sub-agent)';
}

export async function spawnMultipleAgents(tasks) {
  // Run multiple agents in parallel
  const promises = tasks.map(async (task, i) => {
    try {
      const result = await spawnAgent(task);
      return { task, result, index: i, success: true };
    } catch (err) {
      return { task, result: err.message, index: i, success: false };
    }
  });

  const results = await Promise.all(promises);

  return results.map(r =>
    `--- Agent ${r.index + 1}: ${r.task.substring(0, 60)} ---\n${r.success ? r.result : `Error: ${r.result}`}`
  ).join('\n\n');
}
