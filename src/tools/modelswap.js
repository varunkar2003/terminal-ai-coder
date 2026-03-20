// Model Swapping — switch models mid-conversation based on task complexity

import { getConfig, updateConfig } from '../config.js';
import { getProvider } from '../providers/router.js';

export async function switchModel(modelName) {
  updateConfig({ model: modelName });
  const config = getConfig();

  // For Ollama, verify model exists
  if (config.provider === 'ollama') {
    try {
      const { checkModelAvailable, listModels } = await import('../providers/ollama.js');
      const available = await checkModelAvailable(modelName);
      if (!available) {
        const models = await listModels();
        const names = models.map(m => m.name).join(', ');
        return `Model "${modelName}" not found. Available: ${names}\nPull it with: ollama pull ${modelName}`;
      }
    } catch {}
  }

  return `Switched to model: ${modelName}`;
}

export async function listAvailableModels() {
  const config = getConfig();
  const provider = await getProvider();

  try {
    const models = await provider.listModels();
    const current = config.model;
    return `Current: ${current} (${config.provider})\n\nAvailable:\n${models.map(m => {
      const marker = m.name === current ? ' ← current' : '';
      const desc = m.description ? ` — ${m.description}` : '';
      return `  ${m.name}${desc}${marker}`;
    }).join('\n')}`;
  } catch {
    return `Current model: ${config.model} (${config.provider})`;
  }
}

export async function autoSelectModel(taskDescription) {
  const lower = taskDescription.toLowerCase();

  // Heuristic: complex tasks → bigger model, simple tasks → smaller model
  const complexIndicators = [
    'refactor', 'architect', 'design', 'complex', 'full-stack',
    'debug', 'optimize', 'security', 'algorithm', 'system design',
    'build entire', 'create complete', 'multiple files',
  ];

  const isComplex = complexIndicators.some(i => lower.includes(i));
  const config = getConfig();

  if (config.provider === 'ollama') {
    try {
      const { listModels } = await import('../providers/ollama.js');
      const models = await listModels();
      const names = models.map(m => m.name);

      // Try to find a bigger model for complex tasks
      if (isComplex) {
        const bigger = names.find(n => n.includes('14b') || n.includes('13b') || n.includes('70b') || n.includes('32b'));
        if (bigger && bigger !== config.model) {
          updateConfig({ model: bigger });
          return `Complex task detected. Switched to ${bigger} for better results.`;
        }
      }
    } catch {}
  }

  return `Using current model: ${config.model}`;
}
