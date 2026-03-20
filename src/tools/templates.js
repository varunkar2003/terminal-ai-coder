import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const TEMPLATES = {
  react: {
    files: {
      'package.json': JSON.stringify({
        name: '__NAME__',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
        devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^5.0.0' },
      }, null, 2),
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>__NAME__</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
      'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      'src/App.jsx': `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>__NAME__</h1>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}`,
      'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,
    },
    postInstall: 'npm install',
  },

  express: {
    files: {
      'package.json': JSON.stringify({
        name: '__NAME__',
        version: '1.0.0',
        type: 'module',
        scripts: { start: 'node index.js', dev: 'node --watch index.js' },
        dependencies: { express: '^4.18.0' },
      }, null, 2),
      'index.js': `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to __NAME__ API' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
      '.gitignore': 'node_modules\n.env\n',
    },
    postInstall: 'npm install',
  },

  html: {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>__NAME__</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>__NAME__</h1>
  <p>Edit index.html to get started.</p>
  <script src="script.js"></script>
</body>
</html>`,
      'style.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { margin-bottom: 1rem; }`,
      'script.js': `console.log('__NAME__ loaded');`,
    },
    postInstall: null,
  },

  'python-flask': {
    files: {
      'app.py': `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return jsonify({"message": "Welcome to __NAME__ API"})

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)`,
      'requirements.txt': 'flask>=3.0.0\n',
      '.gitignore': '__pycache__\n*.pyc\n.env\nvenv/\n',
    },
    postInstall: 'pip install -r requirements.txt',
  },
};

export function createProject(template, name) {
  const tmpl = TEMPLATES[template];
  if (!tmpl) {
    const available = Object.keys(TEMPLATES).join(', ');
    return `Unknown template: "${template}". Available: ${available}`;
  }

  const projectDir = join(process.cwd(), name);
  if (existsSync(projectDir)) {
    return `Directory "${name}" already exists. Choose a different name.`;
  }

  const created = [];
  for (const [relPath, content] of Object.entries(tmpl.files)) {
    const fullPath = join(projectDir, relPath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const finalContent = content.replace(/__NAME__/g, name);
    writeFileSync(fullPath, finalContent, 'utf-8');
    created.push(relPath);
  }

  let result = `Created project "${name}" from "${template}" template:\n`;
  result += created.map(f => `  - ${f}`).join('\n');
  if (tmpl.postInstall) {
    result += `\n\nNext: cd ${name} && ${tmpl.postInstall}`;
  }
  return result;
}
